# System_Prepare.md

## Overview

This document defines the **architectural and cryptographic foundation** of the ReCreatio platform – a collaborative and educational web system built with:

- **Backend**: ASP.NET Core Web API (.NET 8+)
- **Database**: Microsoft SQL Server (via EF Core)
- **Frontend**: React + TypeScript (Vite)
- **Hosting**: API on a web server, client on GitHub Pages or similar static hosting

The platform is designed for:

- individual educational use,
- schools, parishes, camps and communities,
- online events and live participation (quizzes, forms, etc.).

The core design goal is to provide a **cryptographically enforced, role-based security model** where:

- the **ability to decrypt data is the permission**,
- all sensitive data is stored **encrypted at rest**,
- neither the user nor the server can unilaterally bypass security.

---

## 1. System Purpose

ReCreatio provides:

- **Identity and roles**: users, groups, organisations and technical roles.
- **Encrypted data management**: personal data, parish intentions, quiz results, etc.
- **Auditable operations**: all important actions are written to append-only ledgers.
- **Delegated and temporary access**: QR / link based “shared views” into subsets of data.

The rest of this document focuses on the **foundation**: keys, login, ledgers, caching and high‑level flows.

---

## 2. Architecture Overview

### 2.1 Backend (ASP.NET Core Web API)

- Framework: `.NET 8+`
- Layers:
  - `Recreatio.Api` – controllers and HTTP endpoints
  - `Recreatio.Application` – use cases and domain services
  - `Recreatio.Domain` – entities, value objects, domain events
  - `Recreatio.Infrastructure` – EF Core, SQL Server, encryption adapters, ledger storage
- Authentication:
  - **Custom cryptographic identity system**, no ASP.NET Identity
  - Stateless authentication tokens (JWT or similar) + server-side secret caches

### 2.2 Frontend (React + TypeScript)

- Framework: React + Vite
- State: React Query + local component state
- Transport: HTTPS REST API returning JSON
- Optional future P2P: direct encrypted browser–browser cooperation for some scenarios

---

## 3. Conceptual Security & Key Model

The platform uses a **role-based cryptographic access system**:

- There are **no explicit `canRead` / `canWrite` flags**.
- The **ability to decrypt** the relevant data is the *actual permission*.
- The server enforces business rules, but **cannot invent keys** that were not granted.

### 3.1 Roles and Keys (high level)

- Every *person, group or organisation* is represented as a **role**.
- Each role may have one or more **RoleKeys** used to:
  - decrypt **DataKeys**, which encrypt application data,
  - sign or verify actions (for some roles).
- Each user has a **MasterRole** that represents the person as such and contains:
  - metadata about all other roles they belong to,
  - references to personal data keys (name, date of birth, etc.).

The detailed role model and key attachment rules are described in `Roles_and_Keys.md`.

### 3.2 Encryption Layers

At a high level we distinguish:

- **Password layer**: multiple hashes of the user’s password, used for login and MasterKey derivation.
- **MasterKey**: symmetric key derived from password hashes, used to decrypt the user’s MasterRole.
- **RoleKeys**: symmetric keys attached to roles, used to decrypt DataKeys and occasionally other keys.
- **DataKeys**: symmetric keys used directly to encrypt table columns or blobs.

Only **DataKeys** touch application data. All other keys exist only to **control who can reach which DataKeys**.

### 3.3 Ledgers

Security-critical events are recorded in three logical ledgers:

1. **Auth Ledger**
   - Registration, login attempts and outcomes.
   - Password changes, account state transitions (Active, Locked, Pending, Disabled, etc.).
   - Use of special recovery or reset procedures.

2. **Key Ledger**
   - Creation and rotation of **RoleKeys**, **DataKeys**, **RootReadKey**, **TransferKeys**.
   - Grants and revocations of key access (role membership, SharedViews).
   - Superseding of old keys and marking them as read-only.

3. **Business Ledger**
   - Domain events: created / edited intentions, offerings, quiz sessions, answers, etc.
   - Links between business events and specific Key Ledger entries (e.g. which key was used).

All ledgers are **append-only** and organised as hash chains so integrity can be verified.

---

## 4. Roles and Key Types (Summary)

The detailed semantics of roles and keys are specified in `Roles_and_Keys.md`. Here we only list types that are important for the foundation.

- **MasterRole** – the canonical role representing a person.
- **Organisation / Group roles** – schools, parishes, classes, teams.
- **Position roles** – Teacher in Class 3A, Parish Priest in Parish X, etc.
- **Technical roles** – created by key rotation or for special cases (e.g. SharedViews).

Key types:

- **MasterKey** – per user, derived from the password hashes; used to decrypt the MasterRole.
- **RoleKey** – per role (can be versioned); used to:
  - decrypt DataKeys,
  - decrypt other RoleKeys (delegation),
  - decrypt “view roles” in SharedViews.
- **DataKey** – per “data area”, used to encrypt actual payloads (columns, blobs).
- **RootReadKey** – top-level key that can decrypt all key material in emergencies.
- **TransferKeys** – technical keys used during some rotations and migration flows.

Only the **existence** of keys is stored; key material itself is always encrypted at rest.

---

## 5. Password Hashing and MasterKey Derivation

The platform uses **multi-hash login**. The goal is:

- Server never knows the raw password.
- Server stores only a safe verifier.
- MasterKey can be derived on the server from material the user sends at login, without giving the server reset-level power over other accounts.

### 5.1 Client-Side Hashes

Let `P` be the user’s password. The client computes:

```text
H1 = KDF(P, user_salt)   # long, slow KDF (Argon2id/PBKDF2) with client-side salt
H2 = Hash(H1)
H3 = Hash(H2)
H4 = Hash(H3)
```

Only `H3` is ever sent to the server.

### 5.2 Server-Side Storage

For each account the server stores:

- `stored_H4` – the verifier for login.
- Public metadata needed for KDF parameters.
- Encrypted MasterRole (encrypted with a key derived from H3, see below).
- Encrypted key bundles and other key material (never in cleartext).

The server **never stores H1 / H2 / H3**, only `H4`.

### 5.3 Login Verification and MasterKey

On login:

1. The client sends `H3_login`.
2. The server computes:

   ```text
   H4_login = Hash(H3_login)
   ```

3. The server verifies:

   ```text
   H4_login == stored_H4
   ```

   If not, the login fails and the attempt is recorded in **Auth Ledger**.

4. If the verifier matches, the server derives the **MasterKey**:

   ```text
   MasterKey = KDF(H3_login, server_master_salt || user_id)
   ```

5. Using `MasterKey`, the backend decrypts the user’s **MasterRole**, which contains:
   - references to all membership records,
   - the structure of child roles and personal DataKeys.

`MasterKey` exists **only in RAM**, only for the duration of the session. It is **never stored** in the database.

---

## 6. Sessions, Tokens and Secret Caches

### 6.1 Session and Token

After a successful login:

- The server creates a **session** identified by a random SessionId.
- It derives or loads the **MasterKey** for that session.
- It issues a token (e.g. JWT) containing:
  - `sub` = user id,
  - `sid` = SessionId,
  - expiration, nonce, etc.

The token **does not contain the MasterKey**. It only allows the backend to look up:

- the current account state,
- the session’s MasterKey and secret cache entries.

### 6.2 Secret Caches

There are two logical caches for secret key material:

1. **Request-Local Cache**
   - Lives only for the duration of a single HTTP request.
   - Default location for decrypted keys in **Secure Mode**.
   - Cleared after every request.

2. **Session Secret Cache**
   - Lives for the duration of the authenticated session.
   - Holds:
     - the user’s MasterKey (or a key-encrypted version of it),
     - frequently used RoleKeys and DataKeys.
   - Available only in **Normal Mode**.  
     In **Secure Mode** it is disabled; all keys are reloaded and decrypted per request.

Metadata (role graph, which key id belongs to which role, etc.) is cached separately and is **never secret**.

---

## 7. Data Access Flow

High-level flow when the backend processes a protected request:

1. **Authenticate**
   - Validate the token.
   - Look up the session by SessionId.
   - Retrieve / derive the session’s MasterKey.

2. **Load MasterRole and memberships**
   - Decrypt MasterRole using MasterKey (if not already present in caches).
   - Load role graph metadata and membership records.

3. **Resolve keys**
   - Using membership + the Key Ledger, discover which RoleKeys and DataKeys are needed.
   - Load encrypted key blobs from the database.
   - Decrypt RoleKeys / DataKeys using MasterKey or parent RoleKeys.
   - Store results in Request-Local Cache (and Session Secret Cache, in Normal Mode).

4. **Read / write data**
   - For each table/column encrypted with a DataKey:
     - find the decrypted DataKey,
     - decrypt or encrypt the values.
   - Apply business logic and write Business Ledger entries.

At no point does the client see cryptographic details – only clear data that was authorised through keys.

---

## 8. Shared Views (Links / QR Access)

### 8.1 Concept

A **SharedView** is a *temporary, limited role* that grants read-only access to a **subset of data** (a “view”), for example:

- a participant’s own quiz results,
- a single intention or a small set of intentions related to a donation.

Key properties:

- SharedView access is usually triggered by **scanning a QR code** or **opening a signed link**.
- SharedView is always **owned by another role** (e.g. a teacher’s role, a parish role).
- SharedView gives access **only through keys**, not by bypassing encryption.

### 8.2 Keys in a SharedView

For every SharedView we create:

- a random **SharedViewSecret** (not stored in cleartext),
- a derived **SharedViewKey**:

  ```text
  SharedViewKey = KDF(SharedViewSecret, "SharedView" || SharedViewId)
  ```

- a dedicated **view RoleKey** `ViewRoleKey`, which behaves like a normal RoleKey but is meant only for this view.

We then store:

```text
EncViewRoleKey = Enc(ViewRoleKey, SharedViewKey)
```

The QR code or link encodes:

- `SharedViewId` (or a public identifier),
- a value that allows reconstructing `SharedViewSecret` (for example: the raw secret, or a token that can be mapped to it).

**Interpretation of your requirement:** in practice, the SharedView *“gives access to the key that can decrypt the role, and this key itself is stored encrypted by the SharedViewKey”*. Scanning the QR gives us the SharedViewKey, which unlocks the role key for this view.

### 8.3 Using a SharedView

When someone opens the QR/link:

1. The client sends the SharedView parameters to the backend.
2. The backend:
   - reconstructs `SharedViewKey` from the supplied secret,
   - loads `EncViewRoleKey` from the database,
   - decrypts it to get `ViewRoleKey`,
   - treats the request as if it was executed under this view role.
3. Using `ViewRoleKey` the backend can:
   - decrypt only those DataKeys that are in the **scope** of this view,
   - return the allowed subset of data.

The SharedView does **not** expose the master RoleKeys of the owner; it only exposes one additional wrapped role key.

### 8.4 Linking SharedViews to Accounts

If a user is logged in while using a QR/link:

- The backend can record in the **Business Ledger** that:
  - SharedViewId `V` is now associated with UserId `U`.
- Next time the same user is logged in, they can access the same view **without scanning QR**, because:
  - the system treats SplitView membership like any other membership,
  - `ViewRoleKey` becomes reachable from the user’s MasterRole.

This pattern is essential for:

- anonymised quiz participation,
- intention / offering receipts accessible via QR and later via logged-in account.

---

## 9. Reset and Re-Keying (High Level)

Reset and emergency operations are intentionally conservative.

- A **RootReadKey** exists as a last-resort decryption key:
  - It is never used in normal operation.
  - It is double-encrypted, e.g.:

    ```text
    EncRootForServer = Enc(RootReadKey, K_server)
    EncRootForUser   = Enc(RootReadKey, K_user)
    ```

  - Recovery needs participation from both sides (server-held part and user/trusted-part).

- **Password change**:
  - produces a new H4 and new MasterKey,
  - MasterRole and user-related key material are re-encrypted under the new MasterKey,
  - old MasterKey is discarded.

- **Key rotation**:
  - new RoleKeys / DataKeys are generated and recorded in **Key Ledger**,
  - old keys remain for read-only access,
  - new write operations use the latest keys.

All reset and rotation operations must produce entries in **Auth Ledger** and/or **Key Ledger** so that later audits can reconstruct what happened.

---

## 10. Implementation Notes

- Symmetric encryption: AES‑256‑GCM recommended.
- Asymmetric encryption: RSA‑4096 or modern ECC (for key transport and signatures).
- Password hashing: modern KDF (Argon2id or PBKDF2 with strong parameters).
- All timestamps in ledgers: UTC.
- All ledger entries: hash-chained, append-only.

---

## 11. Summary

- Access rights are a consequence of **which keys a session can unlock**, not boolean flags.
- Passwords are never stored; only a safe verifier `H4` is kept.
- A per-session **MasterKey** derived from `H3` decrypts the user’s MasterRole.
- RoleKeys and DataKeys form a cryptographic hierarchy described in `Roles_and_Keys.md`.
- Three ledgers (Auth, Key, Business) guarantee traceability of authentication, key changes and business events.
- SharedViews provide QR / link based access by exposing a **wrapped role key**, never raw data.
- Secret caches (Normal vs Secure Mode) allow balancing performance and security.

This document serves as the **foundation** which other specifications (roles, login, scenarios) build upon.
