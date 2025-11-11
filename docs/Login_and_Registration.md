# Login and Registration – Specification

> This document defines **account states, registration, login, sessions and reset logic** for the ReCreatio platform.  
> It assumes the cryptographic foundation from `System_Prepare.md` and the role model from `Roles_and_Keys.md`.

---

## 1. Account States

Each account has one of the following states:

- `PendingEmailConfirmation` – registration started, email not confirmed yet (if email is used).
- `Active` – normal state, user can log in.
- `Locked` – temporarily locked due to too many failed attempts or admin action.
- `Disabled` – permanently disabled (e.g. legal request, abuse).
- `Deleted` – soft-deleted; keys may remain for audit but login is impossible.

Allowed transitions:

- `PendingEmailConfirmation` → `Active` (confirmation).
- `Active` → `Locked` (too many failed logins or admin).
- `Locked` → `Active` (timeout or admin).
- `Active` → `Disabled` (admin).
- Any non-deleted → `Deleted` (hard admin decision).

Each transition is recorded in **Auth Ledger** with timestamp, reason and actor (where applicable).

---

## 2. Registration

### 2.1 Data Collected

During registration, the client collects:

- login identifier (email / username),
- password `P`,
- optional personal data (name, etc.).

The client performs a **client-side KDF** on `P`:

```text
H1 = KDF(P, user_salt)   # user_salt chosen client-side or provided by server
H2 = Hash(H1)
H3 = Hash(H2)
H4 = Hash(H3)
```

Only `H3` and the needed metadata are sent to the server.

### 2.2 Server-Side Registration Steps

1. Validate that the login identifier is not already used.
2. Create a new user record in the database.
3. Store:
   - `stored_H4 = Hash(H3)` as password verifier,
   - account state = `PendingEmailConfirmation` or directly `Active` (depending on configuration).
4. Create an initial **MasterRole** entry for this user, encrypted using a key derived from `H3` (i.e. from the MasterKey that will be generated on first login).
5. Optionally send email confirmation.

A registration event is written to **Auth Ledger**.

---

## 3. Login and Multi-Hash Verification

### 3.1 Client Login Request

On login, the client:

1. Asks the user for password `P`.
2. Recomputes:

   ```text
   H1 = KDF(P, user_salt)
   H2 = Hash(H1)
   H3 = Hash(H2)
   ```

3. Sends `H3` to the server together with login identifier.

### 3.2 Server Verification Flow

1. Locate the account using the login identifier.
2. If the account is not in state `Active`, reject the login and record the attempt in **Auth Ledger**.
3. Compute:

   ```text
   H4_login = Hash(H3_login)
   ```

4. Compare `H4_login` with `stored_H4`:
   - If they differ, increment failed login counter, possibly lock account, and reject.
   - If they match, reset failed login counter and continue.

5. Derive **MasterKey**:

   ```text
   MasterKey = KDF(H3_login, server_master_salt || user_id)
   ```

6. Decrypt the user’s **MasterRole** using MasterKey.
7. Create a session (see next section) and issue a token.

Neither `H1` nor `H2` nor `H3_login` is ever stored in the database.

A successful login is recorded in **Auth Ledger** with reference to the corresponding Key Ledger snapshot (for auditing which keys were active at login).

---

## 4. Sessions and Tokens

### 4.1 Session Creation

After verifying login:

1. Generate a secure random `SessionId`.
2. Initialise a **Session Secret Cache** entry:
   - store MasterKey,
   - leave it empty in Secure Mode (see below).
3. Create a row in the session store (DB or in-memory) with:
   - UserId,
   - SessionId,
   - creation time, last activity time,
   - flags: `IsSecureMode`, device info (optional).

### 4.2 Token Content

Return a token (e.g. JWT) to the client with:

- `sub` – user id,
- `sid` – session id,
- `iat`, `exp` – issued-at and expiry timestamps,
- optional claims (organisation, role summary).

The token **never contains**:

- MasterKey,
- RoleKeys,
- DataKeys,
- password hashes.

### 4.3 Request Handling

For each authenticated request:

1. Validate token signature and expiry.
2. Look up session by `sid`.
3. If session is missing or invalid, reject.
4. Load or derive **MasterKey**:
   - from Session Secret Cache (Normal Mode),
   - by re-running KDF based on stored, encrypted material (Secure Mode) – exact mechanism is implementation-specific but must **not** depend on any stored copy of `H3`.
5. Resolve roles and keys (see `Roles_and_Keys.md` and `System_Prepare.md`).
6. Execute business logic and write to ledgers as needed.

---

## 5. Normal Mode vs Secure Mode

Each session can operate in one of two modes:

### 5.1 Normal Mode

- **Session Secret Cache** is enabled.
- MasterKey and frequently used keys (RoleKeys, DataKeys) are cached in memory.
- Best performance, still secure for standard usage.
- Suitable for:
  - everyday work in schools and parishes,
  - most quiz / live scenarios.

### 5.2 Secure Mode

- **Session Secret Cache is disabled**.
- Only Request-Local Cache is used.
- Keys are decrypted **for each request** and then discarded.
- Provides stronger protection against memory attacks or long-lived secrets.
- Suitable for:
  - administrator operations,
  - highly sensitive data views,
  - environments with stricter security requirements.

Users may be allowed to switch between modes per session; the switch is recorded in **Auth Ledger**.

---

## 6. Password Change

### 6.1 Flow Overview

When a logged-in user changes their password:

1. The client collects the **old** password `P_old` and **new** password `P_new`.
2. Client recomputes `(H1_old, H2_old, H3_old)` and sends:
   - `H3_old`,
   - new `H3_new` (with own `H1_new`, `H2_new`),
   - optionally additional confirmation data.

3. Server verifies `H3_old` in the same way as during login.
4. If verification succeeds:
   - derive old `MasterKey_old`,
   - decrypt MasterRole and all user-related key envelopes if needed,
   - compute new hashes and verifier:

     ```text
     H1_new = KDF(P_new, user_salt)
     H2_new = Hash(H1_new)
     H3_new = Hash(H2_new)
     H4_new = Hash(H3_new)
     ```

   - derive new `MasterKey_new = KDF(H3_new, server_master_salt || user_id)`,
   - re-encrypt MasterRole and related user key material under `MasterKey_new`,
   - update `stored_H4` to `H4_new`.

5. Invalidate all existing sessions for that user.
6. Force a new login with the new password.

A `PasswordChanged` event is written to **Auth Ledger** and relevant re-encrypt operations to **Key Ledger**.

---

## 7. Reset and Recovery (High Level)

There is **no classic “forgot my password, send email link + new password”** flow that silently bypasses keys.

Instead, reset is based on **RootReadKey** and **multi-party approval**:

- A special **RootReadKey** can decrypt all encrypted key material.
- It is itself encrypted in multiple ways:
  - `EncRootForServer = Enc(RootReadKey, K_server)`
  - `EncRootForUser = Enc(RootReadKey, K_user_or_threshold_scheme)`
- To use RootReadKey, a predefined set of actors or procedures must participate (e.g. server + M-of-N trusted persons).
- Exact threshold and ceremony are out of scope here, but must ensure:
  - no single party can unilaterally reset somebody else’s data access,
  - all uses are recorded in **Auth Ledger** and **Key Ledger**.

Typical recovery shape:

1. User proves identity via out-of-band method (admin, parish office, school administration).
2. A recovery request is created in **Auth Ledger**.
3. Required parties provide partial approvals (e.g. via hardware token, separate interface).
4. System reconstructs temporary access to user’s encrypted key material via RootReadKey or TransferKeys.
5. User sets a new password, re-encrypts their keys and MasterRole with a new MasterKey.
6. Old password hashes and MasterKey are removed; RootReadKey fragments used for this operation are invalidated if applicable.

Details of this ceremony will be refined later; this document defines only the basic constraints.

---

## 8. Anonymous and QR / Link-Based Access

Some scenarios (especially quizzes) require that **people without an account** can:

- submit answers,
- later see a subset of their own results via QR or link.

This is based on **SharedViews** described in `System_Prepare.md`:

- Anonymous participant answers are stored under a teacher’s or class’ **DataKey**.
- For each participant (or group of answers), the system creates a **SharedView**:
  - defines the scope (e.g. “answers of participant X in quiz Q”),
  - defines `ViewRoleKey` and wraps it with `SharedViewKey`, created from a secret encoded in QR/link.
- When participant scans QR:
  - server uses the QR secret to obtain `SharedViewKey`,
  - decrypts `ViewRoleKey`,
  - uses it to read only the allowed data.

If the same person later logs in with a real account, the SharedView can be **attached** to their MasterRole, so they get access without using QR again.

All creation and use of SharedViews is written to **Business Ledger** and **Key Ledger**.

---

## 9. Security Guarantees

The login and session system guarantees:

- No plaintext passwords are stored or transmitted.
- Compromise of database alone (including `stored_H4`) does **not** give access to user data without significant brute force.
- The server never stores `H2` or `H3` and cannot “pretend” to be the user without re-running the full login flow.
- MasterKey exists only in RAM and only for the lifetime of a session.
- Every change of account state, password or special reset is auditable via **Auth Ledger**.
- Anonymous and QR-based access always happens through **keys**, never through hidden “backdoor endpoints”.

This document is the reference for implementing login, registration, sessions and reset mechanics in the backend and frontend.
