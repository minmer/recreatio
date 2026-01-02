# Roles and Keys – Conceptual Specification

> This document describes the **role model**, **cryptographic key structure** and **key caching strategy** for the ReCreatio platform.  
> It extends `System_Prepare.md` and `Login_and_Registration.md` by focusing specifically on how roles, keys, ledgers and caches interact.

---

## 1. Scope and Goals

This document defines:

- How **roles** are represented and related to each other.
- How **RoleKeys**, **DataKeys**, **RootReadKey** and **TransferKeys** are organised.
- How **key versions** and **role versions** are handled.
- How the backend **discovers**, **loads**, **caches** and **uses** keys when reading or writing encrypted tables.
- How this works in a **multi‑organisation environment**, where a single user can belong to many independent structures.
- How **SharedViews** (links / QR) are represented in the same model.

It does **not** define table schemas or low-level API endpoints – those will be defined elsewhere.

---

## 2. Role Model

### 2.1 What is a Role?

A **role** is any entity that:

- may own data,
- may have keys,
- may delegate or receive permissions.

Everything that “behaves like a role” is stored in a single `Roles` table:

- People (e.g. a person’s MasterRole),
- Groups (e.g. Class 3A, Math Club),
- Organisations (School A, Parish B, Camp C),
- Positions within organisations (Teacher in School A, Student in Class 3A),
- Technical roles created due to key rotation or SharedViews.

All roles share the same structure; what differentiates them is **how they are used**, not their storage.

### 2.2 Master Role of a User

Every user account has exactly one **MasterRole**:

- Represents “this person as such” in the role graph.
- Is encrypted under the user’s **MasterKey** (derived from the multi-hash login flow described in `Login_and_Registration.md`).
- Naturally contains **personal data keys**, such as keys for:
  - first name,
  - last name,
  - date of birth,
  - other personal attributes.

Each personal field is encrypted separately so that access to one field does not automatically imply access to all fields.

A user can have many other roles, but they are always conceptually **children** of the user’s MasterRole in the graph (see 2.3).

### 2.3 Parent–Child Graph

Roles form a **directed graph**:

- `ParentRoleId` / `ChildRoleId` pairs define **membership** and **administration** relations.
- A role may have multiple parents and multiple children.
- Edges are typed (e.g. *MemberOf*, *AdminOf*, *DelegatedTo*).

The graph is used to:

- discover which roles a user effectively belongs to,
- determine which roles can administer other roles,
- reason about key propagation (who should get which RoleKeys).

Cycles are allowed but must be carefully handled in traversal code (e.g. using visited sets).

---

## 3. Keys Attached to Roles

### 3.1 Key Objects

Keys are stored in a logical `Keys` collection with the following high-level fields:

- `KeyId` – stable identifier,
- `KeyType` – `MasterKey`, `RoleKey`, `DataKey`, `RootReadKey`, `TransferKey`, etc.,
- `OwnerRoleId` – role that “owns” this key,
- `Version` – for rotation,
- `EncryptedKeyBlob` – encrypted key material,
- `Metadata` – algorithm, size, flags (read-only, write-enabled, etc.),
- `LedgerRef` – reference to Key Ledger entry that created this key.

### 3.2 MasterKey and MasterRole

- **MasterKey** is *not* stored in `Keys` table:
  - it is derived at login from `H3` and server salt,
  - it lives only in server RAM (sessions).
- MasterRole is stored encrypted with MasterKey.
- MasterRole contains:
  - references to personal DataKeys,
  - references to membership records (see 6).

The rest of the system treats MasterRole like any other role once it is decrypted.

### 3.3 RoleKeys

A **RoleKey**:

- is a symmetric key attached to a specific role,
- may be versioned (old versions for read-only, new versions for read+write),
- is used to:
  - decrypt DataKeys for data owned by that role,
  - decrypt other RoleKeys (delegation),
  - decrypt “view roles” in SharedViews.

In many cases, a role has **exactly one active RoleKey** and several historical “read-only” RoleKeys after rotations.

### 3.4 DataKeys

A **DataKey**:

- is attached to some logical “data area” (e.g. parish intentions, quiz results for class 3A),
- is used to encrypt:
  - table columns (e.g. `IntentionText`, `ParticipantName`),
  - blobs (documents, attachments),
- is itself encrypted under one or more RoleKeys.

Multiple RoleKeys may be able to decrypt the same DataKey (for example: Parish Priest role and Parish Office role).

### 3.5 RootReadKey and TransferKeys

- **RootReadKey** is a special key that (indirectly) can decrypt all other keys:
  - used only in carefully controlled recovery / migration procedures,
  - material is double-encrypted and requires multi-party participation (see `System_Prepare.md` and `Login_and_Registration.md`).

- **TransferKeys** are temporary keys used to:
  - migrate data between organisations,
  - perform complex rotations without exposing RootReadKey,
  - perform M-of-N recovery ceremonies.

Each creation or use of RootReadKey and TransferKeys must be recorded in **Key Ledger** and/or **Auth Ledger**.

---

## 4. Role Versions and Key Rotation

### 4.1 Why Rotations Create New Roles

When an important role changes who controls it (e.g. new parish priest, new head teacher), we:

- create a **new technical role** with a new RoleKey,
- point future DataKeys to the new role,
- keep old roles and RoleKeys for **read-only** access.

This guarantees:

- new owners cannot silently modify historical data encrypted under old keys,
- old owners can still read past data if policy allows it, but cannot sign new operations.

### 4.2 Rotation Flow (Example)

For a parish priest role:

1. Create new RoleKey `K_new` and a new role `ParishPriest_v2`.
2. Grant administrator role (e.g. dean / diocesan admin) admin rights over `ParishPriest_v2`.
3. Reconfigure:
   - new DataKeys for future intentions to be encrypted under `K_new`,
   - old DataKeys remain encrypted under `K_old`.
4. Mark `K_old` as **read-only** in metadata and Key Ledger.
5. Update memberships: new priest is member of `ParishPriest_v2`.

All of this is recorded in **Key Ledger** and parts of it in **Business Ledger**.

---

## 5. Data Access Model

### 5.1 From User to Data

For each request:

1. **Start from MasterRole** (decrypted using MasterKey).
2. Traverse the role graph:
   - direct roles (e.g. Teacher, Student, Parish Priest),
   - indirect roles through organisations / groups.
3. Collect all **reachable RoleKeys** from Key Ledger.
4. For the specific operation, determine which **DataKeys** are relevant:
   - by table/column configuration,
   - by resource identifier (e.g. ParishId, ClassId, QuizId).
5. Decrypt DataKeys using the RoleKeys from step 3.
6. Use DataKeys to decrypt the actual data.

### 5.2 Fine-Grained Fields

For some entities (e.g. personal profile, intention records) different fields may use different DataKeys, for example:

- `FirstName`, `LastName` → personal DataKeys,
- `IntentionText` → parish intention DataKey,
- `OfferingAmount` → separate DataKey, perhaps only accessible to finance roles.

This enables granting read or write to specific subsets of data by granting access only to selected DataKeys.

---

## 6. Membership and Administration

### 6.1 Membership Records

Membership is represented as records such as:

- `UserId`,
- `RoleId`,
- `RelationshipType` (MemberOf, AdminOf, DelegatedTo),
- `EncryptedRoleKeyCopy` (optional),
- `LedgerRef`.

`EncryptedRoleKeyCopy` is a copy of the RoleKey (or a wrapping key) encrypted under:

- the user’s MasterKey,
- or another role’s key (for delegation).

For normal users this makes it possible to efficiently load their RoleKeys after login.

### 6.2 Administration

Administrative roles:

- have **AdminOf** edges to other roles,
- can:
  - add/remove members,
  - trigger key rotations,
  - create SharedViews for their data.

Administrative actions always:

- change membership records,
- possibly create or update keys,
- are written to **Key Ledger** and **Business Ledger**.

---

## 7. Key Discovery and Resolution

The backend resolves keys in several phases:

1. **Load non-secret metadata**
   - Role graph (`Roles`, edges).
   - Key metadata (`KeyId`, `KeyType`, `OwnerRoleId`, flags).
   - Membership records.

2. **Determine required keys**
   - By analysing the requested operation (e.g. “edit intention in parish X”, “show quiz results for class Y”).
   - By mapping resource identifiers to `DataKeyId`s.

3. **Load encrypted key blobs**
   - Encrypted RoleKeys and DataKeys from the database.

4. **Decrypt keys**
   - Using MasterKey (for role keys tied directly to user) or parent RoleKeys.
   - Store them in caches according to mode (Normal vs Secure).

5. **Use keys**
   - Decrypt data for read operations.
   - Encrypt data for write operations.

If at any step the required key cannot be resolved, the operation fails with a clear error (e.g. “no key for this resource in your current roles”).

---

## 8. Key Caching Strategy

The platform uses a three-layer caching strategy for key-related data:

1. **Metadata Cache** (non-secret)
   - Role graph, key metadata, membership.
   - Can be cached long-lived on the server side.
   - Safe to share between sessions and even servers.

2. **Session Secret Cache**
   - Holds MasterKey and frequently used RoleKeys / DataKeys.
   - Exists only in **Normal Mode**.
   - Bound to a specific SessionId and user.

3. **Request-Local Cache**
   - Exists for the duration of a single HTTP request.
   - Used in both Normal and Secure Mode.
   - In Secure Mode it is the *only* place where decrypted keys live.

The caching strategy is designed so that:

- most operations are fast in Normal Mode,
- Secure Mode trades performance for stronger guarantees,
- data is never under-encrypted or decrypted for longer than needed.

### 8.1 Multi-Organisation Considerations

Since a single user may belong to multiple organisations:

- metadata cache must be partitioned or properly indexed by organisation,
- key resolution must respect organisational boundaries (no accidental cross‑organisation access),
- cache entries include organisation identifiers where appropriate.

### 8.2 Key Sharing vs Duplication

Frequently the same DataKey is reachable from multiple roles (e.g. ParishPriest and ParishOffice):

- the key is stored only once per session, identified by `KeyId`,
- caches avoid duplicating decrypted material even if multiple roles point to it.

### 8.3 Eviction

Session Secret Cache uses LRU (least recently used) or similar eviction strategy:

- limit on number of keys per session,
- per-session memory budget,
- explicit invalidation on logout or password change.

### 8.4 SharedViews (Links / QR)

A **SharedView** is represented as a special technical role whose RoleKey is *wrapped* by a SharedViewKey.

Conceptually:

1. A normal role (e.g. Teacher, Parish) owns some DataKeys.
2. The owner creates a **view role** for a particular scope (e.g. “quiz result of participant #123 in quiz Q”, “one intention with id I”).
3. A **view RoleKey** is generated for this view role.
4. We derive a **SharedViewKey** from the secret contained in the QR / link.
5. We store:

   ```text
   EncViewRoleKey = Enc(ViewRoleKey, SharedViewKey)
   ```

6. The QR / link contains just enough information to reconstruct `SharedViewKey` (e.g. a random secret or token).
7. When the QR / link is used:
   - server reconstructs SharedViewKey,
   - decrypts `EncViewRoleKey`,
   - uses `ViewRoleKey` to decrypt only the DataKeys in the scope of that view role.

In other words, **SharedView gives access to the key that decrypts a role, and this key itself is stored encrypted by the SharedViewKey**. No master RoleKeys are exposed.

If later the SharedView is linked to a logged-in account, a membership record is created that treats the view role like any other role. From that point the user’s MasterRole can reach `ViewRoleKey` without using QR.

---

## 9. RSA Authorization Keys and Public Information

Authorization keys (RSA or ECC pairs) require special treatment:

- **Private keys**:
  - are always treated as secret material,
  - follow the same caching rules as other secret keys (Session Secret Cache vs Request-Local Cache),
  - are never exposed to the client.

- **Public keys**:
  - can be cached aggressively,
  - are attached to roles and used to verify signatures (e.g. ledger entries).

Public-facing endpoints may publish certain public keys or certificates, but:

- only for strictly defined roles (e.g. organisation seals),
- with minimal metadata,
- never with personal data or unnecessary information.

---

## 10. Consistency Guarantees and Non-Goals

### 10.1 Consistency

The design provides:

- **Cryptographic consistency**
  - every decryption operation can be traced to a specific `DataKeyId` and Key Ledger entry,
  - every authorisation operation can be traced to a role and possibly a public key.

- **Role-based consistency**
  - a user’s access is strictly a consequence of the roles they have (including SharedViews),
  - rotations and membership changes have clear, auditable effects.

- **Ledger consistency**
  - all key creations, rotations and deletions are captured by **Key Ledger**,
  - all auth events by **Auth Ledger**,
  - all business events (intention changes, quiz answers, etc.) by **Business Ledger**.

### 10.2 Non-Goals

This document does **not** define:

- exact SQL schemas for roles, keys, ledgers,
- token formats,
- UI behaviour.

Those are left to separate implementation specifications.

---

## 11. Summary

- All actors (people, groups, organisations, technical constructs) are represented as **roles**.
- Access rights are enforced by **keys** (RoleKeys and DataKeys), never by plain boolean flags.
- The user’s MasterRole is encrypted under a MasterKey derived from their password hashes.
- Key rotation produces new roles and key versions; old keys become read-only but remain usable where policy allows.
- The backend uses a three-layer caching strategy and supports Normal and Secure modes.
- SharedViews are implemented as technical roles with wrapped RoleKeys, giving QR / link based access to limited scopes.
- Three ledgers (Auth, Key, Business) jointly guarantee full auditability of authentication, key changes and business actions.

This document is the conceptual source of truth for how roles, keys, SharedViews and caches interact in the ReCreatio platform.
