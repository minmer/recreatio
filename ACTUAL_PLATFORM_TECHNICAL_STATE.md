# ReCreatio platform: actual technical state

**Audit date:** 2026-08-22  
**Audited source:** the current working tree in this repository  
**Status of this document:** implementation audit and current-state description  
**Primary scope:** ReCreatio foundation, Parish, Chat, Calendar, Hortus, and composable Events  
**Secondary scope:** the platform modules and infrastructure that share the same runtime, identity, database, frontend, and deployment surface

---

## 1. Purpose and interpretation

This document describes what the platform is **actually implemented as in the current source tree**. It is deliberately different from a target architecture, product vision, or migration plan.

The following evidence was used:

- backend source under [backend/Recreatio.Api](backend/Recreatio.Api);
- frontend source under [frontend/src](frontend/src);
- the EF Core model and migration under [backend/Recreatio.Api/Migrations](backend/Recreatio.Api/Migrations);
- SQL bootstrap and patch files under [backend/Recreatio.Api/Sql](backend/Recreatio.Api/Sql);
- configuration in [backend/Recreatio.Api/appsettings.json](backend/Recreatio.Api/appsettings.json);
- the existing root Markdown specifications, especially:
  - [System_Prepare.md](System_Prepare.md);
  - [Login_and_Registration.md](Login_and_Registration.md);
  - [Roles_and_Keys.md](Roles_and_Keys.md);
  - [Hortus_Reservations.md](Hortus_Reservations.md);
  - [COGITA_DESIGN_THINKING.md](COGITA_DESIGN_THINKING.md);
  - [cogita-graph.md](cogita-graph.md);
  - the Cogita JSON and visual-system documents;
  - [Forms_Import_JSON.md](Forms_Import_JSON.md).

The repository already contained a large set of uncommitted changes when this audit was made. This report therefore describes the **working tree**, not only the last Git commit.

This is not proof of the state of the production database or production secrets. There is no production database inspection, secret-store inspection, traffic capture, penetration test, or deployed-host configuration included here. Wherever configuration can override repository defaults, the report says so.

### 1.1 Source-of-truth order used in this report

When code and documents disagree, this report uses the following order:

1. Executable source and runtime registration.
2. Current EF Core model and SQL files.
3. Frontend callers and routing.
4. Existing Markdown specifications.
5. Comments and names in source.

The Markdown files remain important because they describe the intended security model. They are not treated as evidence that the intended behavior is already implemented.

### 1.2 Meaning of integration

The word “integration” is used in four different senses in this codebase:

1. **Runtime integration** — modules run in one API process and one SPA.
2. **Identity integration** — modules share the ReCreatio login cookie and user table.
3. **authorization/cryptographic integration** — a module uses the central Role, Membership, RoleEdge, KeyEntry, DataItem, and DataKeyGrant model.
4. **business integration** — one module creates, updates, or enforces relationships with objects owned by another module.

The platform has strong runtime integration, partial identity integration, uneven cryptographic integration, and currently very little true cross-module business integration.

---

## 2. Executive conclusion

ReCreatio is currently a **modular monolith in one repository**, with:

- one ASP.NET Core 8 minimal API project;
- one React 18 and TypeScript SPA built by Vite;
- one SQL Server database represented by one very large EF Core context;
- a mixture of central encrypted Role/DataItem infrastructure and module-specific authorization systems;
- three global hash-chain ledgers plus one parish-partitioned ledger;
- two hosted background services;
- both new and legacy event implementations active at the same time.

The code is substantially implemented. It is not merely a mock platform:

- the backend compiles successfully with zero warnings and zero errors;
- the Vite production bundle completes;
- the named modules have real database models and endpoint surfaces;
- Calendar protected details and generic account data use AES-GCM data-key wrapping;
- Chat messages are encrypted;
- Parish intentions and offerings have encrypted fields;
- Hortus has a real hierarchical availability engine;
- Events has a database-driven composable site editor and individual recipient links;
- Calendar has recurrence, role scopes, groups, graph execution, shared links, and a reminder dispatcher.

However, the platform does **not** implement one uniform security architecture across all modules:

| Module | Primary authority | Payload protection | Ledger coverage |
|---|---|---|---|
| Core account/roles | role keys and memberships | extensive AES-GCM key hierarchy | Auth, Key, Business |
| Parish | central parish roles, often tested by readable AdminRole | selective AES-GCM and Data Protection; much plaintext | extensive Parish ledger, uneven signatures |
| Chat | participant boolean flags whose role subjects are resolved through the central key ring | AES-GCM messages; conversation keys protected by server Data Protection | none |
| Calendar | central role keys plus explicit binding/scope rows | public fields plaintext; protected details in DataItems | broad Business/Key ledger coverage |
| Hortus | one user-based PortalAdminAssignment | reservation/contact data plaintext; requester token hashed | none |
| Composable Events | one global user-based PortalAdminAssignment plus plaintext bearer links | registrations, participant cards, topics, and link metadata plaintext | admin claim only |

The most important current conclusion is:

> The modules share a host, database, frontend, and login, but they do not yet form one consistently authorized, encrypted, auditable business platform.

The most important architectural and security findings are:

1. The design documents say the server never stores H3 and Secure Mode must not depend on stored H3. The implementation embeds H3 in the protected authentication cookie and re-derives the MasterKey from that claim.
2. Database session revocation is not enforced by the cookie validation pipeline or by the key-ring service. Many protected module endpoints accept a still-valid copied cookie even after the database session has been revoked.
3. Parish, Hortus, and composable Events do not validate the existing CSRF token on their authenticated mutations.
4. Sensitive Event participant-card data, including health-related data and data about minors, is stored as plaintext JSON.
5. Chat encryption is server-readable: the server Data Protection ring wraps conversation keys. Chat permission is enforced by boolean participant rows, not by distributing decryption keys to participants.
6. The ledger hash-chain algorithm is implemented, but appending is not serialized. Concurrent writers can create forks with the same previous hash.
7. The ledgers are not database-enforced append-only logs, do not have an external anchor, and do not cover all modules.
8. Calendar SharedView records create a wrapped view-role key, but the public Calendar readers do not decrypt or use that key. They only validate the secret hash and return public fields.
9. Parish’s displayed calendar is currently generated from frontend mock data, not the Calendar API.
10. Chat scope values such as parish and event are labels and filters. They do not create foreign-key or access-control integration with Parish or Events.
11. Calendar’s LinkedModule and LinkedEntity fields are passive metadata. The other named modules do not synchronize into Calendar.
12. Hortus checks availability before writes but does not serialize competing reservations. Concurrent requests can pass the same check.
13. Database evolution is split among a destructive all-in-one schema, one broad EF migration, and manual patches. The Calendar code references a patch file that does not exist.
14. Vite builds because it transpiles without TypeScript checking. A separate type-check currently reports 197 TypeScript errors, including 19 in Calendar and 9 in Parish.

The integration is therefore **functionally broad but security- and domain-wise incomplete**. The strongest parts are the core encryption primitives, generic role/data-key foundation, Hortus availability modeling, and the breadth of Calendar and Event domain features. The weakest parts are uniform enforcement, token handling, schema lifecycle, ledger concurrency, sensitive-data classification, and cross-module orchestration.

---

## 3. Platform topology

### 3.1 Runtime topology

~~~text
Browser
  |
  | HashRouter SPA, fetch with credentials
  v
React/Vite application at recreatio.pl
  |
  | HTTPS cross-origin API calls
  | default API base: https://api.recreatio.pl
  v
ASP.NET Core 8 minimal API
  |
  +-- cookie authentication
  +-- CORS
  +-- named fixed-window rate limiter
  +-- CSRF service, when endpoint calls it
  +-- request error logging
  +-- module endpoint groups
  +-- Calendar reminder hosted service
  +-- Cogita retention hosted service
  +-- Cogita SignalR hub
  |
  +--------------------+----------------------+
  |                    |                      |
  v                    v                      v
SQL Server        Data Protection       Local encrypted
single DbContext  key ring on disk       blob directory
                                      secure-file-store
~~~

### 3.2 Repository shape

The conceptual documents describe separate Domain, Application, Infrastructure, and API projects. The implementation does not have those assemblies. It has one backend project:

- [Recreatio.Api.csproj](backend/Recreatio.Api/Recreatio.Api.csproj), targeting .NET 8;
- Data contains EF entities and the large DbContext;
- Contracts contains request/response records;
- Crypto contains symmetric/asymmetric primitives;
- Security contains claim, key-ring, and session-secret logic;
- Services contains application logic and hosted services;
- Endpoints contains minimal API route handlers;
- Hosting registers services and the middleware pipeline.

The separation is by folders and namespaces, not by project or assembly boundaries.

The frontend is one SPA. Route selection is largely manual inside [App.tsx](frontend/src/App.tsx), rather than a normal nested declarative route tree. HashRouter is initialized in [main.tsx](frontend/src/main.tsx).

### 3.3 Current size of the primary implementation

At audit time:

- backend: 332 C# source files, excluding build output;
- frontend: 285 TypeScript, TSX, and CSS source files;
- central frontend API client: 8,782 lines;
- Parish endpoint file: 7,730 lines;
- Parish page: 13,525 lines;
- Calendar endpoint files: 5,035 lines;
- Calendar page: 2,989 lines;
- Chat endpoints: 1,909 lines;
- composable Event endpoints: 3,079 lines.

This scale matters because module boundaries exist by convention, but several critical modules are effectively large single-file applications.

### 3.4 Main API endpoint surfaces

| Area | Prefix | Approximate endpoint count |
|---|---:|---:|
| authentication | /auth | 9 |
| account and role management | /account plus /roles | 31 |
| Parish | /parish | 59 |
| Chat | /chat | 17 |
| Calendar | /calendar | 40 |
| Hortus | /hortus | 21 |
| composable Events | /events | 52 |

The API also maps Cg, Cogita, Cogita games/core runtime, Library, Forms, Pilgrimage, EDK, Rowerowa, Limanowa, and health endpoints in the same process.

---

## 4. Backend process and request pipeline

### 4.1 Startup

[Program.cs](backend/Recreatio.Api/Program.cs) is intentionally small:

1. create the ASP.NET builder;
2. call AddRecreatioApi;
3. build the app;
4. call UseRecreatioPipeline;
5. run.

There is no database migration or schema verification step at startup.

### 4.2 Registered infrastructure

[ServiceCollectionExtensions.cs](backend/Recreatio.Api/Hosting/ServiceCollectionExtensions.cs) registers:

- OpenAPI endpoint discovery and Swagger generation;
- custom JSON converters for Guid and TimeOnly;
- the SQL Server DbContext;
- ASP.NET Core Data Protection with a filesystem key ring;
- CORS;
- rate limiting;
- cookie authentication and authorization;
- SignalR;
- singleton crypto services;
- scoped key-ring, role, ledger, session, auth, Chat, Calendar, Cogita, and Library services;
- an HttpClient for Calendar webhooks;
- HttpClients for the Python sandbox and external book lookups;
- two hosted services;
- encrypted local blob storage.

### 4.3 Middleware order

[ApplicationBuilderExtensions.cs](backend/Recreatio.Api/Hosting/ApplicationBuilderExtensions.cs) installs:

1. Swagger and Swagger UI;
2. HTTPS redirection;
3. CORS;
4. authentication;
5. authorization;
6. rate limiting;
7. custom request logging;
8. endpoint maps.

Swagger is enabled unconditionally, including outside Development.

There is no global exception-handling middleware or RFC-wide error envelope. Individual endpoints catch selected exceptions; unhandled exceptions rely on framework behavior.

### 4.4 CORS

The fixed allowlist is:

- https://recreatio.pl
- https://api.recreatio.pl
- http://localhost:5173
- https://localhost:5173

Credentials, all headers, and all methods are allowed for those origins.

### 4.5 Rate limiting

Only one named policy, “auth”, is registered:

- 30 requests per minute outside Development;
- 1,000 per minute in Development;
- no queue.

It is used by registration/login and selected public actions such as Chat public questions. It is not a general abuse-control layer for Parish candidate operations, Hortus public booking, or Event public form submissions.

### 4.6 Request logging

[RequestLoggingMiddleware.cs](backend/Recreatio.Api/Hosting/RequestLoggingMiddleware.cs) captures mutation request bodies for paths beginning with:

- /account
- /roles
- /auth
- /cogita

It buffers up to 2,000 characters and logs error response bodies. If an error response has no body, it can log the captured request body. There is no field redaction.

That design can expose secret-bearing request data to logs in some failure paths, including:

- H3 values used by register/login;
- old and new H3 values during password change;
- role/data mutation payloads;
- Cogita content.

The middleware does not capture Parish, Chat, Calendar, Hortus, or Events bodies, which reduces logging visibility for those modules but also avoids this specific body-leak risk there.

### 4.7 Health endpoint

/health returns an “ok” value and current time. It does not test:

- SQL connectivity;
- schema compatibility;
- Data Protection key readability;
- blob-store writability;
- background worker health;
- webhook delivery;
- required secret validity.

It is a liveness endpoint, not a readiness endpoint.

---

## 5. Identity, password derivation, and session chain

This is the most important shared chain in the platform.

### 5.1 Browser-side derivation

[frontend/src/lib/crypto.ts](frontend/src/lib/crypto.ts) implements:

~~~text
UserSalt = 32 random bytes
H1 = PBKDF2-HMAC-SHA256(password, UserSalt, 150000 iterations, 32 bytes)
H2 = SHA-256(H1)
H3 = SHA-256(H2)
~~~

The browser sends H3, not the original password.

The frontend also retains a legacy-iteration retry mechanism for older accounts. This is compatibility behavior, not an algorithm identifier stored in the account row.

### 5.2 Server verifier

At registration:

~~~text
StoredH4 = SHA-256(H3)
~~~

At login:

~~~text
LoginH4 = SHA-256(received H3)
FixedTimeEquals(LoginH4, StoredH4)
~~~

The fixed-time comparison is correct.

The consequence of this design is that **H3 is a password-equivalent network credential** for normal login. An attacker with H3 does not need the original password to authenticate.

### 5.3 MasterKey derivation

[MasterKeyService.cs](backend/Recreatio.Api/Security/MasterKeyService.cs) derives:

~~~text
salt = Base64Decode(ServerMasterSalt) concatenated with userId.ToByteArray()
MasterKey = PBKDF2-HMAC-SHA256(H3, salt, 600000 iterations, 32 bytes)
~~~

The iteration count and output length are configurable.

The checked-in placeholder “REPLACE_WITH_BASE64_SALT” is not a valid Base64 production secret. A real deployment must override it. If it does not, MasterKey derivation fails when Convert.FromBase64String is called.

Changing the server master salt without rewrapping all user-bound key material makes existing encrypted master-role keys inaccessible.

### 5.4 Authentication mechanism

The implementation uses ASP.NET Core **cookie authentication**, not JWT:

- cookie name: recreatio.auth;
- HttpOnly: true;
- SameSite from configuration, currently None;
- Secure policy from configuration, currently Always;
- sliding expiration enabled;
- normal idle duration: 60 minutes;
- remember-me duration: 30 days;
- IsPersistent is set to true for both remembered and non-remembered sessions, with different explicit expirations.

The cookie principal contains:

- sub: user ID;
- sid: database session identifier;
- sm: Secure Mode flag;
- rm: remember-me flag;
- h3: Base64 H3.

The authentication cookie is protected by ASP.NET Core Data Protection.

### 5.5 The H3 documentation contradiction

[System_Prepare.md](System_Prepare.md) and [Login_and_Registration.md](Login_and_Registration.md) say:

- the server never stores H3;
- Secure Mode must not depend on a stored copy of H3;
- tokens should carry identity/session metadata, not keys.

The implementation does not store H3 in a database column, but it places H3 in the long-lived protected authentication ticket. The server creates, decrypts, refreshes, and consumes that ticket.

This means:

- H3 survives beyond the login request;
- Secure Mode can re-derive MasterKey only because H3 is recovered from the cookie claim;
- possession of the Data Protection key ring plus an authentication cookie permits recovery of H3 and derivation of the user’s MasterKey;
- the security boundary is materially different from the documents.

This is not a wording-only discrepancy. It changes the threat model.

### 5.6 Database sessions

A successful login creates a Session row containing:

- opaque 32-byte Base64URL session ID;
- user ID;
- device information;
- Secure Mode flag;
- created and last-activity timestamps;
- revoked flag.

SessionService.RequireSessionAsync verifies that the session is not revoked and updates LastActivityUtc.

There is no session expiration column and no session cleanup worker. Cookie expiry provides the effective timeout where database session validation is actually called.

### 5.7 Session revocation gap

Cookie authentication validates the Data Protection ticket. It does not call SessionService in an OnValidatePrincipal hook.

KeyRingService also:

- reads user/session IDs from cookie claims;
- recovers or derives MasterKey;
- builds role keys;
- does **not** verify the Session row.

Many module endpoints call KeyRingService directly and never call RequireSessionAsync. Hortus and Events admin guards only resolve the authenticated user claim and their PortalAdminAssignment.

Therefore:

- logout revokes the database row and expires the current browser’s cookie;
- password change revokes all session rows;
- but a previously copied authentication cookie can remain accepted by many feature endpoints until the protected ticket expires;
- /auth/me can reject a revoked session while Chat, Calendar, Parish, Hortus, Events, account, or role paths may still trust the same principal depending on their call path.

This is a high-severity, platform-wide consistency problem.

### 5.8 Password change

The password-change service:

1. verifies old H3 through old H4;
2. derives old and new MasterKeys;
3. re-encrypts master-role read/write/owner KeyEntry blobs;
4. re-encrypts all direct Membership key copies;
5. writes the new StoredH4;
6. revokes every active database session;
7. clears in-memory session secrets;
8. appends PasswordChanged and RoleKeysReEncrypted ledger entries.

The endpoint then reissues an authentication cookie with the same session ID and new H3 even though that Session row has just been revoked.

This produces inconsistent post-change behavior:

- /auth/me rejects the reissued session;
- feature endpoints that do not validate the Session row can continue;
- the documents describe forcing a clean login, but the endpoint attempts to preserve the session.

### 5.9 Account lockout and discovery

The implementation supports:

- active, blocked/locked, and related account state handling;
- maximum 5 failed attempts;
- 15-minute lockout;
- H4 fixed-time verification;
- Auth ledger entries for login outcomes.

The salt endpoint explicitly returns “LoginId not found” for unknown accounts, and the availability endpoint reveals whether an identifier exists. Account enumeration is therefore an accepted current behavior.

RequireEmailConfirmation is configurable and false by default. No complete email-confirmation delivery flow was found in the audited authentication path.

---

## 6. CSRF model

### 6.1 How it works

[CsrfService.cs](backend/Recreatio.Api/Services/CsrfService.cs) implements a double-submit token:

1. /auth/csrf creates 32 random bytes;
2. the value is returned in the response body;
3. it is also stored in a readable XSRF-TOKEN cookie;
4. the frontend caches the body value because a cookie set by api.recreatio.pl is not necessarily readable from recreatio.pl;
5. the generic frontend request wrapper adds X-XSRF-TOKEN;
6. protected endpoints explicitly call CsrfService.Validate;
7. validation checks exact equality of cookie and header.

The token is not cryptographically bound to a session/user and has no explicit expiry. As a random double-submit token this can still provide CSRF protection, provided it cannot be planted or read by an attacker and every relevant endpoint validates it.

### 6.2 Actual enforcement

| Surface | CSRF status |
|---|---|
| authentication mutations | validated |
| many account/role mutations | validated through their endpoint implementations |
| Chat authenticated mutations | validated |
| Calendar authenticated mutations | validated |
| Parish authenticated mutations | no CSRF service use found |
| Hortus authenticated admin mutations | no CSRF service use found |
| composable Events authenticated admin mutations | no CSRF service use found |

Because the auth cookie is configured SameSite=None, missing endpoint validation cannot be dismissed as a SameSite-cookie defense. CORS is not a replacement for CSRF validation.

---

## 7. Central role and key architecture

### 7.1 Role as a cryptographic identity

Each normal Role can contain:

- encrypted private encryption key;
- encrypted private signing key;
- public encryption key and algorithm;
- public signing key and algorithm;
- encrypted role fields describing role metadata;
- three symmetric role keys.

At registration and normal role creation, the backend generates:

- RoleReadKey: random 32 bytes;
- RoleWriteKey: random 32 bytes;
- RoleOwnerKey: random 32 bytes;
- RSA encryption key pair: 2048 bits;
- RSA signing key pair: 2048 bits.

The private RSA values are serialized as RoleCryptoMaterial and encrypted with RoleOwnerKey in Role.EncryptedRoleBlob.

Public algorithms are:

- RSA-OAEP-SHA256 for encryption;
- RSA-PKCS1-SHA256, named RSA-SHA256, for signatures.

The design document recommends RSA-4096 or modern ECC. The implementation uses RSA-2048.

### 7.2 Root master role

Every account has one MasterRole.

The three MasterRole key entries are encrypted under MasterKey with the MasterRole ID bytes as AES-GCM associated data:

~~~text
MasterKey
  |
  +-- AES-GCM -> MasterRole ReadKey
  +-- AES-GCM -> MasterRole WriteKey
  +-- AES-GCM -> MasterRole OwnerKey
~~~

The MasterRole’s private RSA material is then reachable through OwnerKey.

### 7.3 AES-GCM representation

[EncryptionService.cs](backend/Recreatio.Api/Crypto/EncryptionService.cs) stores each encrypted value as:

~~~text
12-byte random nonce
+ ciphertext
+ 16-byte authentication tag
~~~

AES-GCM provides confidentiality and integrity. Nonces are randomly generated per encryption. Most central key-wrapping operations include object-specific associated data.

Associated data is not embedded in the ciphertext; callers must reconstruct exactly the same value for decryption.

### 7.4 Memberships

A Membership directly grants a user access to a role. It contains separately wrapped copies:

- read key, always;
- write key, optionally;
- owner key, optionally.

Each copy is encrypted under the user’s MasterKey with RoleId as associated data.

Membership.RelationshipType remains plaintext. RoleEdge relationship metadata is encrypted separately.

### 7.5 Role edges

A RoleEdge connects parent role to child role. It can carry:

- child read key encrypted under parent read key;
- child write key encrypted under parent write key;
- child owner key encrypted under parent owner key;
- encrypted relationship type;
- HMAC of relationship type using parent read key.

The read, write, and owner graphs are traversed independently.

The general edge endpoint does not reject graph cycles. KeyRingService terminates traversal because it will not add an already-discovered role twice. Cycles are therefore representable and computationally tolerated, although they complicate ownership and deletion reasoning.

### 7.6 Key-ring construction

For an authenticated request:

1. obtain user ID, session ID, Secure Mode, and H3 from claims;
2. recover MasterKey from the normal-mode in-memory cache, or derive it from H3;
3. load the account’s MasterRole read/write/owner key entries;
4. load every Membership for the user;
5. decrypt membership key copies under MasterKey;
6. load **all RoleEdges** from the database;
7. breadth-first traverse readable edges;
8. separately traverse writable edges;
9. separately traverse owner edges;
10. return dictionaries keyed by RoleId.

The service loads all edges for every uncached key-ring construction. This is simple, but it scales with the platform-wide edge table rather than the user’s reachable subgraph.

### 7.7 Normal versus Secure Mode

Normal Mode:

- caches MasterKey;
- caches the complete RoleKeyRing;
- cache key is session ID.

Secure Mode:

- does not read or write the in-memory secret cache;
- derives MasterKey from H3 in the cookie on each request;
- rebuilds the key ring;
- decrypted values still exist as request-local method variables and dictionaries.

The in-memory cache is an unbounded ConcurrentDictionary:

- no TTL;
- no LRU;
- no size limit;
- no background eviction;
- removal occurs on logout, password change, Secure Mode transition, and selected key-graph mutations.

This does not implement the three-cache model and LRU strategy promised by [Roles_and_Keys.md](Roles_and_Keys.md).

### 7.8 DataItem and DataKeyGrant

Generic protected data uses envelope encryption:

~~~text
random DataKey
  |
  +-- AES-GCM -> actual value
  +-- AES-GCM -> encrypted item name/type metadata

RoleReadKey
  |
  +-- AES-GCM -> wrapped DataKey in DataKeyGrant
~~~

The same DataKey can be wrapped for multiple roles. Possession of an applicable role read key allows the caller to unwrap the DataKey and decrypt the item.

This is the part of the implementation that most closely matches the central documents’ intended data-access model.

### 7.9 Encrypted file store

Generic account files can be written to a local secure-file-store directory:

- default maximum upload: 50 MiB;
- default chunk: 64 KiB;
- each chunk uses a random 12-byte AES-GCM nonce;
- associated data binds DataItemId and chunk index;
- plaintext SHA-256 is recorded;
- path traversal is rejected;
- relative paths are date-partitioned.

The encryption key comes from the DataItem key hierarchy. The file is encrypted at rest, but availability depends on the local filesystem unless the deployment mounts persistent shared storage and backs it up.

### 7.10 Recovery implementation

Role recovery tables and endpoints exist:

- RoleRecoveryShare;
- RoleRecoveryKey;
- RoleRecoveryRequest;
- RoleRecoveryApproval.

Activation:

- generates a random recovery key;
- XORs random share parts into a server part;
- encrypts each share part to a selected role’s RSA public encryption key;
- encrypts the resulting server part under the target role’s write key;
- records activation in Key ledger.

The current workflow is not an operational “lost all keys” recovery:

- activation requires current write and owner access;
- requesting recovery also requires current write and owner access to the target role;
- completion again requires current write and owner access;
- completion changes status and revokes shares;
- it does not reconstruct a recovery key, decrypt lost role material, create a replacement owner, or rewrap data.

It is currently a recovery-approval state machine and encrypted-share store, not a completed emergency recovery mechanism.

### 7.11 Key rotation

The design documents describe role-version rotation, historical read-only keys, and new technical roles.

Current implementation has:

- KeyEntry.Version;
- explicit Chat conversation-key versions;
- password-triggered MasterKey rewrapping;
- some share/recovery revocation timestamps.

It does not implement a general platform-wide role-key rotation lifecycle with:

- old role versions marked read-only;
- automatic data-key rewrapping;
- historical signature-key version pinning;
- enforced creation of new technical roles.

---

## 8. Data Protection as a second key system

ASP.NET Core Data Protection is a second, server-owned cryptographic root, distinct from the Role/DataKey hierarchy.

It protects:

- the authentication cookie;
- Chat conversation keys;
- Parish confirmation-candidate payloads.

The key ring is persisted to:

- backend/Recreatio.Api/dataprotection-keys relative to the API content root.

That directory is Git-ignored. A local XML key file existed during this audit, but it is not tracked by Git.

Repository defaults:

- certificate path: empty;
- certificate thumbprint: empty;
- RequireCertificateOutsideDevelopment: false.

Outside Development, the API logs a warning and continues with keys persisted without certificate protection.

Operational implications:

- losing this ring invalidates auth cookies;
- losing this ring makes Chat conversation keys unreadable;
- losing this ring makes Parish confirmation-candidate payloads unreadable;
- copying this ring to an attacker substantially expands compromise impact;
- multi-instance deployment requires a shared, synchronized Data Protection ring;
- container or redeploy storage must be persistent;
- because H3 is in the protected cookie, this ring protects a password-equivalent value as well.

Data Protection should therefore be treated as a high-value platform master secret, not as incidental framework state.

---

## 9. Hash-chain ledgers

### 9.1 Ledger families

There are four logical ledgers:

1. AuthLedger — one global chain.
2. KeyLedger — one global chain.
3. BusinessLedger — one global chain.
4. ParishLedger — a separate chain per ParishId.

Each entry contains:

- Id;
- TimestampUtc;
- EventType;
- Actor;
- PayloadJson;
- PreviousHash;
- Hash;
- optional SignerRoleId;
- optional Signature;
- optional SignatureAlg.

### 9.2 Exact hash construction

[LedgerHashing.cs](backend/Recreatio.Api/Services/LedgerHashing.cs) builds a UTF-8 payload:

~~~text
timestampUnixMilliseconds
| eventType
| actor
| payloadJson
| signerRoleId-or-empty
| signatureAlgorithm-or-empty
~~~

It then computes:

~~~text
Hash = SHA-256(PreviousHash concatenated with UTF8Payload)
~~~

The first entry uses an empty PreviousHash.

The entry ID is not part of the hash. The ledger name is not part of the hash. ParishId is not part of the Parish entry hash. Partition selection keeps Parish chains separate, but the cryptographic payload does not bind an entry to a specific ParishId.

### 9.3 Signatures

If the caller supplies a LedgerSigningContext:

1. compute the entry hash;
2. sign that hash using the role’s decrypted private signing key;
3. store role ID, signature, and RSA-SHA256 algorithm.

Signatures are optional. Many entries are deliberately or incidentally unsigned.

Verification loads each signer role’s **current** public signing key. The entry does not store:

- a public-key fingerprint;
- a key version;
- an immutable certificate;
- the public key itself.

Changing or losing the role’s public key can therefore make historical signature verification ambiguous or impossible.

### 9.4 Append behavior

LedgerService appends by:

1. querying the latest row ordered by TimestampUtc descending;
2. using its Hash as PreviousHash;
3. using DateTimeOffset.UtcNow;
4. calculating and optionally signing the new hash;
5. adding the entry;
6. calling SaveChangesAsync.

For Parish, the latest-row query is filtered by ParishId.

### 9.5 Verification behavior

The account verification endpoint:

- requires readable access to a requested role;
- loads **every row** of all three global ledgers;
- sorts by TimestampUtc then Id;
- recomputes the chain;
- counts hash mismatches;
- counts PreviousHash mismatches;
- verifies optional signatures against current role public keys;
- reports signature counts for the requested role.

The requested role does not scope which ledger records are loaded. It only authorizes the operation and is used for a signature subtotal.

No corresponding Parish-ledger verification endpoint was found.

### 9.6 What the chain does guarantee

Under serialized append behavior and assuming a trusted starting point, it can detect:

- modification of hashed fields in an existing row;
- deletion from the middle of a chain;
- reordering;
- an incorrect PreviousHash;
- invalid role signatures where signatures exist and the correct historical public key remains available.

### 9.7 What it does not guarantee

The current chain does not independently guarantee:

- append-only database storage;
- a unique head;
- no concurrent forks;
- that all important operations are logged;
- that every entry is signed;
- that PayloadJson uses canonical JSON;
- that a global chain belongs to a specific tenant;
- that a Parish row is cryptographically bound to its ParishId;
- that the chain has not been completely rewritten by an actor with database and signing-key access;
- an externally timestamped or notarized anchor;
- atomicity between business state and ledger state.

### 9.8 Concurrency defect

There is no lock, serializable transaction, sequence number, or unique constraint around the “read latest then insert” operation.

Two concurrent requests can both read head H:

~~~text
          +--> entry A, PreviousHash = H
head H ---+
          +--> entry B, PreviousHash = H
~~~

Only one row will happen to come first in the verifier’s TimestampUtc/Id sort. The other branch will cause a mismatch.

This is not a theoretical edge case on a busy global Auth/Key/Business ledger. Global chains combine activity from all users and modules.

### 9.9 Transactional inconsistency

LedgerService calls SaveChangesAsync itself. Callers frequently save business state and then append a ledger entry. Other call sites append the ledger before saving the business object. Some operations use an ambient DbContext transaction, many do not.

Possible outcomes include:

- business update committed, ledger append failed;
- ledger entry committed, later business update failed;
- several ledger entries committed separately for one logical operation;
- audit event ordering that does not exactly match transaction ordering.

### 9.10 Coverage by named module

Static append call sites in the focus modules:

| Module | Ledger append call sites |
|---|---:|
| Parish | 46 |
| Calendar | 23 |
| Events | 1 |
| Chat | 0 |
| Hortus | 0 |

The single composable Events call records claiming the global Events administrator.

The current documents’ statement that all important business operations are ledgered is not true across the platform.

---

## 10. Integration matrix

| Concern | Parish | Chat | Calendar | Hortus | Composable Events |
|---|---|---|---|---|---|
| Same API process | yes | yes | yes | yes | yes |
| Same SQL DbContext | yes | yes | yes | yes | yes |
| Same SPA | yes | yes | yes | yes | yes |
| Central cookie login | admin paths | internal paths | internal paths | admin paths | admin paths |
| Central roles/key ring | yes | role subjects only | yes | no | no |
| Central DataItem grants | intentions/offerings use related keys | no | protected details/proof | no | no |
| Server Data Protection | confirmation payload | conversation key | auth cookie indirectly | auth cookie only | auth cookie only |
| Module bearer links | several plaintext tokens | hashed public/invite code | hashed codes and SharedView secret hash | hashed requester token | plaintext access token |
| Business ledger | Parish-specific | none | global Business/Key | none | admin claim only |
| Background worker | no | long polling only | reminder dispatcher | no | no |
| True Parish link | native | scope label only | no; Parish UI is mock | none | none |
| True Event link | confirmation event is separate parish entity | scope label only | passive metadata only | none | native event domain only |
| Cross-module FK | internal Parish only | none for ScopeId | none for LinkedEntityId | none | none |

---

## 11. Parish module

### 11.1 Purpose and shape

Parish is a large tenant-like domain under /parish with:

- public parish catalogue and site configuration;
- public Mass and intention views;
- administrative parish creation and site editing;
- role hierarchy and encrypted parish financial/intention data;
- Mass definitions and Mass rules;
- Confirmation candidate registration;
- phone verification;
- first- and second-year meeting booking;
- host/invite/join decisions;
- candidate portal;
- messages and notes;
- celebrations and participation;
- confirmation events and joins;
- CSV-like import/export and candidate merging;
- parish-specific audit ledger.

It has 20 entity files and one 7,730-line endpoint file.

### 11.2 Parish role hierarchy

Creating a parish provisions:

- parish root role;
- administrator role;
- priest role;
- office role;
- finance role;
- public role.

Each role has:

- independent random read/write/owner keys;
- RSA-2048 encryption and signing pairs;
- encrypted private role material.

RoleEdges connect the hierarchy and carry wrapped child keys. The creating user receives an owner Membership in the parish administrator role.

The Parish row stores the role IDs directly.

### 11.3 Parish data-key areas

Creation also provisions logical key/data areas for:

- internal intention data;
- public intention data;
- offerings.

Data keys are wrapped for selected parish roles through DataKeyGrant rows. The Parish record stores data-item and key IDs.

### 11.4 Intentions

ParishIntention stores:

- Mass time, church, public text, and status in plaintext;
- InternalTextEnc encrypted;
- DonorRefEnc encrypted;
- a data-key identifier.

The encrypted values use AES-GCM through the central encryption service.

Both InternalTextEnc and DonorRefEnc use the intention ID as associated data. Random nonces prevent nonce reuse, but the associated data does not distinguish the fields. An attacker able to alter database ciphertext can swap the two encrypted blobs inside the same record without an AAD field-name mismatch. The application may then interpret valid decrypted content as the wrong field.

### 11.5 Offerings

ParishOffering stores:

- encrypted amount;
- encrypted donor reference;
- plaintext currency;
- plaintext date;
- plaintext intention relationship.

The same field-binding observation applies: amount and donor ciphertext use the offering ID but not a distinct field label in associated data.

### 11.6 Confirmation candidate payload

ParishConfirmationCandidate.PayloadEnc is not protected by the central role/data-key system. It uses a Data Protection purpose chain scoped to:

~~~text
parish
confirmation-candidate
ParishId
~~~

This protects the serialized candidate payload at rest from a database-only reader, but:

- any API instance with the Data Protection ring can decrypt it;
- access is not cryptographically limited to parish roles;
- backup/recovery depends on the Data Protection ring;
- it uses a different key lifecycle from intentions and offerings.

The acceptance/consent and progress flags remain plaintext columns.

### 11.7 Plaintext sensitive Parish data

The following are plaintext in their entity rows:

- confirmation messages;
- confirmation notes;
- celebration comments;
- meeting stages and assignments;
- candidate/event join status;
- site configuration JSON;
- Mass notes, rule graph JSON, intention summaries, donation summary;
- SMS templates;
- phone VerificationToken;
- meeting BookingToken;
- HostInviteToken.

This does not satisfy the broad statement in System_Prepare.md that all sensitive data is encrypted at rest.

### 11.8 Public capability tokens

Confirmation operations use several bearer capabilities:

- phone verification token;
- meeting booking token;
- host invite token.

They are stored as plaintext and queried by equality.

Current properties:

- phone verification tokens do not have a dedicated expiry field;
- meeting booking links do not have an expiry or revoked field;
- host invite tokens have an expiry and are cleared in some state transitions;
- admin responses expose tokens needed to contact candidates;
- public mutations using these capabilities are not covered by the named rate limiter.

If the Parish database is read, these capabilities can be used directly.

### 11.9 Authorization enforcement

Parish uses the central KeyRingService. However, many administrative checks test:

~~~text
keyRing.ReadKeys contains parish.AdminRoleId
~~~

even for writes, deletes, and state transitions.

This collapses the practical distinction between read and write permission for those routes. The central model has separate keys, but the module often treats possession of the AdminRole read key as administrative authority.

Mass helpers and other mutations show the same pattern in several places.

### 11.10 CSRF

No ICsrfService use was found in the Parish endpoint file. Authenticated Parish mutations rely on cookie authentication and role checks without the platform’s double-submit validation.

### 11.11 Parish ledger

Parish has the broadest domain audit coverage among the focus modules:

- candidate registration and verification;
- meeting bookings and changes;
- joins and decisions;
- messages, notes, celebrations, events;
- intentions, Masses, offerings, and configuration.

Some privileged financial/intention operations obtain the administrator role’s signing material and sign the entry. Many public or administrative Confirmation operations are unsigned.

The Parish ledger has the same append-race problem as global ledgers. It has only a ParishId index and no unique head or sequence. No public/admin Parish-chain verification endpoint was found.

### 11.12 Parish frontend

[ParishPage.tsx](frontend/src/pages/parish/ParishPage.tsx) is a single 13,525-line component containing:

- public site;
- configurable module layout;
- administration;
- intention and Mass UI;
- Confirmation candidate and meeting UI;
- public candidate portal;
- imports/exports;
- multiple dashboards and dialogs.

The component’s size makes permission-state reasoning and regression testing difficult.

### 11.13 Parish and Calendar are not integrated

The Parish frontend has a CalendarModule, but it calls buildCalendarMock and constructs events in browser memory.

It does not:

- query /calendar;
- create a calendar scoped to the parish;
- mirror Parish Masses;
- mirror confirmation events or celebrations;
- bind Parish roles to a central Calendar;
- preserve Calendar event IDs in Parish entities.

Parish Masses and confirmation events are their own tables, unrelated to CalendarEvent.

### 11.14 Parish and Chat are not integrated

No Parish endpoint creates or enforces a Chat conversation.

A Chat can be labeled:

- ScopeType = parish;
- ScopeId = an arbitrary string.

That is a Chat-side label, not a Parish-owned relation. Parish membership does not automatically grant the Chat and removing Parish access does not automatically remove a Chat participant.

### 11.15 Parish and Events are not integrated

Parish confirmation events are not composable EventSite objects. They have independent entities, endpoints, joins, and frontend behavior.

There is no synchronization of:

- site content;
- registrations;
- Calendar events;
- Chat scope;
- access links;
- participant cards.

### 11.16 Parish assessment

What is realized well:

- real role/key provisioning;
- selective encryption of intentions and offerings;
- strong breadth of Confirmation workflows;
- per-parish audit stream;
- clear public/private split for intention text;
- server-side candidate-payload protection.

What is incomplete or unsafe:

- read keys commonly authorize mutations;
- mixed key systems create inconsistent threat models;
- many sensitive fields and capability tokens are plaintext;
- missing CSRF;
- no public-operation rate limiting;
- no central Calendar or Chat integration;
- ledger verification and concurrency are incomplete;
- extremely large endpoint and page files.

---

## 12. Chat module

### 12.1 Domain

Chat supports:

- group, direct, and public-board conversations;
- scope labels global, parish, event, limanowa, and cogita;
- role or user participants;
- read/write/manage/respond-public flags;
- internal and public messages;
- message sequencing and read states;
- public read/question links;
- invite links;
- optional history visibility;
- key rotation;
- long polling.

### 12.2 Stored conversation metadata

ChatConversation stores plaintext:

- title;
- description;
- chat type;
- scope type and scope ID;
- creator IDs;
- public settings;
- active key version;
- last message sequence.

The title and description are not encrypted.

### 12.3 Participant authorization

ChatConversationParticipant stores:

- SubjectType: role or user;
- SubjectId;
- CanRead;
- CanWrite;
- CanManage;
- CanRespondPublic;
- MinReadableSequence;
- removal timestamp.

For role subjects, the caller’s currently reachable role IDs are obtained from the central KeyRing. Then authorization is decided from the participant booleans.

This is identity integration with the central role graph, but it is not key-enforced Chat access. [Roles_and_Keys.md](Roles_and_Keys.md) says rights should be enforced by keys and never by plain boolean flags; Chat contradicts that statement.

### 12.4 Message encryption

Each conversation receives a random 32-byte symmetric key.

The key is stored in ChatConversationKeyVersion.EncryptedKeyBlob after protection by an ASP.NET Data Protector with purpose:

~~~text
recreatio.chat.conversation-keys.v1
~~~

Message text uses AES-GCM with associated data:

~~~text
ConversationId : Sequence : KeyVersion
~~~

This correctly binds ciphertext to:

- conversation;
- message order;
- selected key version.

It prevents a database-only reader from reading message text if they do not also have the Data Protection ring.

It is not end-to-end encryption:

- the API decrypts every message for authorized readers;
- the API can unwrap every conversation version;
- participants do not receive or hold conversation keys;
- the Data Protection ring is the root of all Chat confidentiality.

### 12.5 Sequence handling

Sending a message starts an EF transaction, loads the tracked conversation, increments LastMessageSequence, encrypts using the next sequence, inserts the message, and commits.

There is a unique index on ConversationId plus Sequence. This provides a useful last-line collision constraint. Correct multi-instance behavior still depends on transaction isolation and conflict handling around concurrent increments.

### 12.6 Key rotation

Participant changes rotate the conversation key:

- adding or changing participants rotates;
- removal rotates;
- removing a participant re-encrypts history;
- adding with IncludeHistory true re-encrypts history;
- adding without history creates a MinReadableSequence boundary and rotates without rewriting old messages.

Old key-version rows remain protected by the server. The server can still decrypt old messages where policy permits.

History re-encryption rewrites every active message and can become expensive for long conversations.

### 12.7 Public links

Public and invite codes:

- are generated from 18 random bytes;
- are Base64URL-encoded;
- are stored only as SHA-256 hashes;
- support active/revoked and optional expiry values;
- use fixed hash comparisons in relevant resolution paths.

This is a better bearer-token storage pattern than the composable Events and Parish plaintext-token patterns.

Public boards expose only public-visibility messages and can allow unauthenticated questions.

### 12.8 Invite behavior

Invite links can read **all internal messages** without an account. This is an explicit feature, not encryption bypass: possession of the invite code is the authorization and the server decrypts the content.

Joining requires authentication and CSRF.

If RoleId is supplied during join, the endpoint verifies only that the role exists. It does not verify that the joining user currently possesses that role. This allows a link holder to create a participant grant for an arbitrary existing role.

The joining user may not personally benefit if they cannot reach that role, but members of the targeted role can gain access. This is an authorization-integrity defect.

### 12.9 Scope integration

ScopeType and ScopeId are:

- validated strings;
- stored on the conversation;
- usable as list filters.

They are not:

- foreign keys;
- checked against an existing Parish, Event, Limanowa event, or Cogita library;
- used to derive participants;
- used to enforce the source module’s permissions;
- maintained when the source object is deleted.

An authenticated user can create a Chat labeled for an arbitrary parish/event scope if they otherwise satisfy Chat creation checks.

### 12.10 Realtime behavior

Chat does not use the registered SignalR hub. Its poll endpoints:

- loop for up to a bounded wait;
- query repeatedly;
- delay about 850 to 900 milliseconds between checks.

Consequences:

- one server request remains open per polling client;
- repeated database queries create load;
- horizontal scaling adds duplicated polling work;
- there is no server push, backplane, or event fan-out.

The only mapped SignalR hub is for Cogita games.

### 12.11 Ledger and CSRF

Authenticated Chat mutations validate CSRF. The public question endpoint uses the named rate limiter.

No Chat ledger append calls exist. Creating conversations, adding participants, rotating keys, reading invite links, joining, and posting messages are not represented in Auth, Key, or Business ledger.

### 12.12 Chat assessment

What is realized well:

- authenticated encryption for message text;
- good message AAD;
- hashed public codes;
- key versions and participant-change rotation;
- role-based participant subjects;
- history boundaries;
- CSRF on authenticated mutations.

What is incomplete or misleading:

- not end-to-end encryption;
- permissions are boolean rows, contrary to the conceptual spec;
- Data Protection compromise exposes all conversations;
- scope integration is metadata-only;
- invite join can target an unrelated role;
- invite code can read internal history;
- no ledger;
- long polling rather than shared realtime infrastructure;
- key/history rotation cost grows with conversation size.

---

## 13. Calendar module

### 13.1 Domain breadth

Calendar supports:

- calendar containers;
- optional slug and organization scope;
- role bindings viewer/editor/manager;
- appointments and tasks;
- public, role, and private visibility;
- public title/summary/location;
- protected details;
- protected task-completion proof;
- owner, participant, and viewer role scopes;
- viewer flags for title/graph visibility;
- daily, weekly, monthly, and custom recurrence fields;
- conflict queries;
- reminders;
- simple public share links;
- cryptographic-style SharedView links;
- event groups;
- weekly series;
- group shared links;
- schedule graphs, nodes, edges, and executions;
- derived appointments/tasks;
- background reminder dispatch.

Calendar has the broadest cross-cutting design among the named modules, but most of its cross-module fields are not consumed elsewhere.

### 13.2 Calendar authorization

CalendarContainer has an OwnerRoleId. CalendarRoleBinding stores:

- RoleId;
- AccessType: viewer, editor, or manager;
- revoked timestamp.

Effective access combines:

- possession of the role key in the caller’s KeyRing;
- an active binding row;
- ownership.

Event-specific scopes add owner, participant, or viewer roles.

Calendar generally distinguishes:

- CanRead;
- CanWrite;
- CanManage.

It validates CSRF on authenticated mutations.

### 13.3 Plaintext/public event fields

CalendarEvent stores the following in plaintext:

- TitlePublic;
- SummaryPublic;
- LocationPublic;
- visibility and status;
- item type and task state;
- all timing and recurrence information;
- progress and completion time;
- owner/assignee roles;
- linked-module/entity fields;
- source-field mapping;
- conflict mode.

The “Public” names are literal: these values are not encrypted even for private events.

Database readers can infer:

- event schedule;
- public title/summary/location;
- role IDs;
- module/entity relationships;
- task state and completion.

Only ProtectedDetailsJson and optional CompletionProofJson receive the DataItem envelope.

### 13.4 Protected details

When protected details are supplied:

1. create a new DataItem ID;
2. generate a random 32-byte DataKey;
3. encrypt the JSON value with AES-GCM;
4. encrypt item-name and item-type metadata;
5. wrap DataKey under the event owner role’s **read key**;
6. create one owner-role DataKeyGrant;
7. store ProtectedDataItemId on CalendarEvent.

Read resolution:

1. find active grants for roles in the caller’s readable role set;
2. obtain that role’s read key;
3. unwrap DataKey;
4. decrypt the value.

By default only the owner role receives a grant. Adding participant/viewer scope rows does not automatically create DataKeyGrants for those roles. A viewer may see public event fields but not protected details unless they can reach the owner role or a grant is created through another central data-sharing path.

### 13.5 Protected metadata nuance

The Calendar helper encrypts the DataItem’s item-name and item-type metadata using the DataKey. The generic helper name suggests a role read key, but symmetric AES accepts either. Calendar does not depend on generic metadata lookup for its event path, so this is internally consistent but diverges from the usual generic DataItem convention.

### 13.6 Updates and orphan risk

If the existing protected item cannot be updated through a readable grant, Calendar can create a replacement DataItem and repoint the event.

The old DataItem and grant are not necessarily deleted or revoked in that fallback. Repeated replacements can leave orphaned encrypted records.

Clearing ProtectedDataItemId or CompletionProofDataItemId also does not demonstrate complete encrypted-object lifecycle cleanup.

### 13.7 Recurrence

Calendar stores structured recurrence fields and expands occurrences in CalendarGraphRuntimeService.

Supported paths include:

- none;
- daily;
- weekly;
- monthly;
- a custom rule field;
- explicit weekly-series creation.

Expansion is bounded to avoid unbounded generation. Weekly series creation caps generated occurrences at 520. Public group responses cap returned items at 2,000.

The recurrence implementation is custom and is not a complete RFC 5545 engine.

### 13.8 Conflict detection

Calendar can query overlapping events by:

- calendar;
- participant roles;
- time range;
- optional ignored event;
- conflict scope mode.

It is an advisory and application-enforced check. No database exclusion constraint prevents two concurrent create/update transactions from introducing a conflict after both pass the query.

### 13.9 Schedule graphs

Calendar schedule graphs contain:

- graph metadata and template config;
- typed nodes;
- directed edges;
- event-graph links;
- execution records with idempotency keys;
- trigger and result JSON.

The runtime supports node behavior around triggers, delays, conditions, creation of tasks/appointments, and no-op paths. Derived events inherit key public/module fields and role scopes from their source.

Graph execution is real server-side behavior, not only a frontend visual editor.

The TypeScript graph editor currently has many React Flow generic-type errors, although Vite transpiles it.

### 13.10 Simple public share links

The original CalendarEventShareLink path:

- generates a random code;
- stores a hash;
- tracks expiry/revocation/last use;
- returns public event fields.

This is a conventional server-mediated public link.

### 13.11 Calendar SharedViews

The newer Calendar SharedView creation path:

1. generates a random share code;
2. hashes the code;
3. creates SharedViewId and ViewRoleId;
4. creates a random ViewRoleReadKey;
5. derives SharedViewKey with PBKDF2 from code and SharedViewId;
6. encrypts ViewRoleReadKey under SharedViewKey;
7. creates an otherwise empty Role for the view;
8. creates SharedView containing EncViewRoleKey and secret hash;
9. creates CalendarSharedViewLink or CalendarEventGroupShareLink;
10. writes Business and Key ledger entries.

This resembles the design in System_Prepare.md.

The public read path does not complete that chain. It:

1. hashes the supplied code;
2. scans up to 500 active links;
3. compares against SharedViewSecretHash;
4. validates expiry;
5. loads event/group;
6. returns ToPublicResponse.

It does **not**:

- derive SharedViewKey;
- decrypt EncViewRoleKey;
- traverse a view-role edge;
- unwrap DataKeys;
- return protected details;
- attach the view role to an account.

No Calendar DataKeyGrant or edge is created for ViewRoleId.

Therefore the created wrapped role key is presently cryptographic scaffolding, not the actual authorization path. The public secret acts as a hashed bearer code for public fields.

Cogita contains a more complete SharedView traversal implementation, but that does not make Calendar’s public reader complete.

### 13.12 LinkedModule integration

CalendarEvent has:

- LinkedModule;
- LinkedEntityType;
- LinkedEntityId;
- SourceFieldStart;
- SourceFieldEnd.

Calendar can store and filter these values. Calendar graph-derived events copy them.

No code outside Calendar was found that:

- creates Calendar events for Parish Masses;
- creates Calendar events for confirmation events;
- creates Calendar events for composable EventSites;
- creates Calendar events for Hortus reservations;
- consumes Calendar completion to update another module;
- validates LinkedEntityId against a source table.

This is an integration hook, not an integration.

### 13.13 Reminder dispatcher

CalendarReminderDispatcherHostedService:

- starts with the API;
- polls every configured interval, clamped to 10–3,600 seconds;
- default is 60 seconds;
- looks back 5 minutes and ahead 60 minutes by default;
- processes at most 250 reminder rows per discovery cycle by default;
- expands occurrences;
- creates CalendarReminderDispatch rows;
- uses ReminderId plus OccurrenceStartUtc as a unique logical dispatch;
- attempts webhook delivery immediately;
- separately processes retry candidates.

The database model has a unique index on:

~~~text
ReminderId, OccurrenceStartUtc
~~~

That is useful idempotency protection, although competing workers can still race and one must handle the resulting unique violation.

### 13.14 Reminder channels

Accepted channels include:

- inapp;
- email;
- sms;
- push;
- webhook.

Only webhook is executed.

Other channels create dispatch rows with:

~~~text
pending_channel_not_enabled
~~~

There is no email, SMS, push, or in-app delivery worker in the current release.

### 13.15 Webhook behavior

Webhook ChannelConfigJson can specify:

- arbitrary absolute HTTP or HTTPS URL;
- arbitrary HTTP method;
- secret;
- arbitrary headers.

Payload includes public event data and dispatch metadata. If a secret exists, the API sends HMAC-SHA256 in X-Recreatio-Signature.

Retry:

- attempt count increments;
- backoff doubles and caps at 720 minutes;
- no maximum attempt count or terminal dead-letter threshold was found.

Security/operations issues:

- no hostname allowlist;
- no private/reserved-IP rejection;
- no redirect policy hardening;
- URL, secret, and headers are stored as plaintext JSON;
- arbitrary headers can carry secrets into the database;
- a user with Calendar write rights can potentially target internal services: SSRF risk;
- webhook response bodies and errors can be stored in LastError;
- no distributed worker lease exists.

### 13.16 Multi-instance background behavior

Each API instance runs its own reminder dispatcher.

The unique dispatch constraint limits duplicate dispatch-row creation, but:

- retry candidates are selected without a lease;
- multiple instances can pick the same failed dispatch;
- HTTP delivery is outside a durable queue transaction;
- a crash after remote success but before database success can cause a retry;
- idempotency ultimately depends on the receiver honoring the idempotency key.

This is at-least-once webhook delivery, not exactly-once delivery.

### 13.17 Calendar ledger

Calendar writes Business ledger entries for:

- calendar and binding changes;
- event lifecycle;
- completion;
- groups and weekly series;
- share creation/revocation;
- other advanced operations.

It writes Key ledger entries for SharedView key creation.

Most Calendar ledger writes are unsigned. They use the same global chain and concurrency limitations described earlier.

### 13.18 Calendar assessment

What is realized well:

- broad scheduling/task model;
- role-aware binding and event scopes;
- real protected detail envelope;
- recurrence and conflict querying;
- graph execution;
- CSRF;
- reminder discovery and webhook idempotency key;
- hashed share secrets;
- substantial audit calls.

What is incomplete or risky:

- module linkage is passive metadata;
- public event fields stay plaintext regardless of visibility;
- protected grants do not follow viewer scopes automatically;
- Calendar SharedView key is unused by the reader;
- other reminder channels are disabled;
- webhook SSRF and plaintext secret risk;
- multi-instance worker coordination is incomplete;
- conflict checking is race-prone;
- missing referenced patch_calendar_schema.sql;
- TypeScript graph UI does not type-check.

---

## 14. Hortus reservation module

### 14.1 Domain

Hortus has five tables in the hortus schema:

- HortusPlaces;
- HortusResources;
- HortusReservations;
- HortusReservationItems;
- HortusReservationStatusLogs.

It supports:

- public place/resource display;
- night and timed-slot bookings;
- resources organized as a tree;
- per-resource capacity;
- technical padding before/after;
- whole-resource exclusive blocks;
- public availability;
- dry-run checking;
- public requests;
- requester status/cancellation links;
- administrator timeline;
- administrator decision/override;
- place/resource configuration.

### 14.2 Availability model

HortusResource describes:

- parent/child structure;
- kind;
- booking unit: night, slot, or both;
- number of concurrent groups;
- guest capacity;
- technical minutes;
- public-bookable and active flags.

HortusReservationItem stores resolved UTC intervals plus source local dates.

The availability engine evaluates:

- direct resource overlap;
- ancestor exclusive occupancy;
- subtree occupancy;
- distinct active reservation counts for capacity;
- technical padding;
- pending versus confirmed semantics;
- ignored reservation for update checks;
- force/override paths for administrators.

Confirmed reservations occupy capacity. Pending requests are warnings/tentative state rather than hard blockers.

### 14.3 Time zones and DST

Place configuration uses a Windows time-zone identifier, defaulting to Central European Standard Time.

The code:

- maps the configured zone;
- converts local night check-in/check-out to UTC;
- handles invalid local DST time by advancing;
- chooses one offset for ambiguous times;
- stores resolved UTC intervals.

This is a thoughtful implementation. The selected ambiguous-time policy should nevertheless be documented as a business rule because either occurrence can be surprising.

### 14.4 Requester capability

Public submission returns:

- human code such as HD-XXXXXX;
- random requester token from 24 bytes;
- reservation view.

Only SHA-256(token) is stored. Token comparison:

- hashes the supplied token;
- uses CryptographicOperations.FixedTimeEquals;
- returns the same not-found behavior for unknown code and wrong token.

This is one of the better public capability implementations in the platform.

### 14.5 Stored data

The following are plaintext:

- group name;
- organization;
- contact name;
- contact email;
- contact phone;
- guest count;
- purpose note;
- administrator note;
- reservation intervals and resources.

RequestedByUserId can associate a request with an account, but public status access still depends on the token. The user association is not a complete “my reservations” authorization path.

### 14.6 Administration

Hortus does not use central roles or role keys.

It uses PortalAdminAssignment with ScopeKey hortus-dei:

- the first authenticated user can claim the unassigned scope;
- one UserId is the administrator;
- each admin endpoint checks that assignment;
- the ScopeKey has a unique index.

PortalAdminAssignment is declared in the Pilgrimage data namespace and reused by Hortus and Events. That is a technical coupling to a legacy module.

### 14.7 Availability race

Public request creation:

1. validates and resolves requested intervals;
2. calls the availability engine;
3. if accepted, inserts reservation and item rows.

Administrator confirmation similarly evaluates state in application logic.

There is no:

- serializable transaction around check and insert;
- database exclusion constraint;
- occupancy lock row;
- row-version compare;
- reservation-slot materialization with a unique constraint.

Two concurrent submissions can both see availability and both write. The database indexes make queries faster but do not enforce capacity.

### 14.8 CSRF, abuse, and ledger

Hortus:

- has no CSRF validation on admin mutations;
- has no general rate limit on public checking/submission/status cancellation;
- has no captcha or proof-of-work;
- has no ledger append calls;
- has a status-log table, but that is a mutable business history, not the cryptographic ledger;
- has no notification or email worker.

### 14.9 Documentation assessment

[Hortus_Reservations.md](Hortus_Reservations.md) is the most accurate module document in the repository:

- five-table model matches;
- statuses match;
- availability hierarchy matches;
- endpoints and frontend paths broadly match;
- patch_hortus.sql exists.

The document does not discuss:

- plaintext personal data;
- first-claim administrator risk;
- missing CSRF/rate limiting;
- concurrency races;
- notification absence;
- lack of central roles/ledger.

### 14.10 Hortus assessment

What is realized well:

- clear normalized booking model;
- tree-aware conflict rules;
- technical padding;
- timezone conversion;
- secure hashed requester token;
- uniform not-found response;
- public/admin separation;
- idempotent patch file.

What is incomplete or risky:

- plaintext PII and notes;
- race-prone capacity enforcement;
- single user-based administrator;
- no CSRF;
- no public abuse controls;
- no ledger;
- no notification delivery;
- no Calendar integration.

---

## 15. Composable Events module

### 15.1 Two event generations coexist

The frontend explicitly treats:

- /event as the new database-driven composable Events system;
- /event_old as legacy hand-coded event applications during migration.

Legacy event families also have separate backend domains:

- Pilgrimage;
- EDK;
- Rowerowa;
- Limanowa;
- Forms.

The result is not one Event domain. It is:

1. a new generic EventSite builder;
2. several specialized legacy event systems;
3. route compatibility in the SPA;
4. separate SQL tables and access-token patterns.

### 15.2 Composable event content model

EventSite stores:

- slug, title, subtitle;
- catalogue summary/category/audience/places;
- date range and display label;
- thumbnail;
- theme JSON;
- SMS template;
- publication status.

Each site has:

- one public page;
- zero or more internal pages.

Pages contain ordered EventPart rows. Supported part kinds include:

- title;
- shortinfos;
- text;
- plan;
- map;
- form;
- costs;
- faq;
- people;
- files;
- gallery;
- contact.

Additional internal renderers support participant cards and topics/discussion.

Part ConfigJson and LayersJson are kind-owned JSON blobs.

### 15.3 Forms and registrations

Form part fields are relational:

- field kind;
- label/help/options;
- required/half-width;
- identity role: none, name, contact.

Public submission validates configured fields and stores:

- EventRegistration;
- EventRegistrationValue per answer;
- extracted participant name/contact;
- optional access-link association.

Values and identity columns are plaintext.

Public submissions are not rate-limited and have no CSRF requirement, which is normal for anonymous forms but requires a separate anti-abuse strategy that does not exist here.

### 15.4 Individual access links

EventAccessLink contains:

- a 24-random-byte Base64URL token;
- recipient name/contact;
- optional registration;
- active/revoked status;
- personal and internal notes;
- contact-verified time;
- view counters and timestamps.

Per-link rows grant specific internal pages. Per-link assignment rows hold label/value details.

The token is:

- stored in plaintext;
- indexed uniquely;
- queried by direct string equality;
- returned in full by admin list endpoints;
- not given an expiry timestamp.

It can be rotated or revoked, but database disclosure gives immediate usable access to every active link.

### 15.5 “Contact verification”

The first successful link open sets ContactVerifiedUtc.

The source comment assumes the token was sent to only one phone/contact and therefore possession proves contact reachability. The system itself does not:

- deliver the message;
- validate the destination;
- perform a challenge/response;
- distinguish forwarding;
- distinguish an organizer opening the link;
- bind the token to a device.

The field means “link opened at least once”, not verified legal identity or verified ownership of the stored contact method.

### 15.6 Participant cards

EventParticipantCard is explicitly designed for:

- address;
- PESEL or equivalent identifying fields in DataJson;
- guardian details;
- health data;
- minor status;
- consents;
- full information clause;
- signer role and name;
- participant name;
- submission timestamps.

The entity comments acknowledge health data under RODO/GDPR Article 9 and data about minors.

All of the following are plaintext:

- DataJson;
- ConsentsJson;
- ClauseText;
- signer name;
- participant name.

Access is protected only by:

- the plaintext bearer token at API level;
- the global Events administrator for admin list/read.

There is no:

- AES-GCM envelope;
- role-key DataKeyGrant;
- Data Protection wrapper;
- field-level encryption;
- separate encryption key per event/person;
- cryptographic deletion.

This is the most serious at-rest data-protection gap in the focus modules.

### 15.7 Topics

Events topics are intentionally modeled as searchable question threads, not Chat:

- topic author;
- title;
- status;
- ordered messages;
- author names and bodies;
- link-based posting.

Topic and message content is plaintext.

This is a deliberate separate business model, but it duplicates conversation functionality without using Chat encryption, audit, or participant roles.

### 15.8 Event images

EventImage stores uploaded bytes directly in SQL:

- file name;
- content type;
- byte size;
- data;
- creation time.

The source explicitly states images are unencrypted because they are public backgrounds. The upload endpoint has an application cap and validates supported image behavior.

Database storage simplifies backup consistency but increases database size and memory/response considerations.

### 15.9 Administration

Composable Events uses PortalAdminAssignment ScopeKey events:

- one global administrator for every EventSite;
- first authenticated claimant when unassigned;
- administrator can create/update/delete all sites, pages, parts, fields, registrations, links, participant cards, topics, and images.

It does not use:

- per-site owner roles;
- central role edges;
- per-event administrators;
- data-key possession;
- Parish roles.

Only the administrator claim is written to Business ledger.

### 15.10 CSRF and audit

Events authenticated admin mutations require cookie authorization and IsAdminAsync, but do not validate ICsrfService.

Normal event operations do not append to the platform ledgers:

- site creation/edit/delete;
- form submissions;
- link creation/rotation/revocation;
- internal-page grants;
- participant-card submission/update/delete;
- topic creation/moderation;
- image upload/delete.

### 15.11 Destructive deletion

Site/page/part/link deletion manually removes dependent rows in a particular order.

This is explicit and understandable, but:

- deletion spans many statements;
- transaction use is not consistently explicit;
- a partial failure can leave unexpected state unless EF/database transaction behavior covers the full SaveChanges;
- deleting a link can delete its participant card;
- deleting registration intentionally detaches links/cards in some paths;
- audit evidence for deletion is absent.

### 15.12 Route-token exposure

The SPA uses HashRouter. Tokens appear after the URL fragment marker in browser-facing links, so browsers normally do not send them as HTTP Referer fragments.

They are still exposed to:

- browser history;
- copied URLs;
- screenshots;
- frontend JavaScript;
- client telemetry/error reporting if added;
- the API request path when the SPA calls /events/link/{token}.

Plaintext database storage remains the larger issue.

### 15.13 Event and Calendar integration

EventSite has dates, plans, pages, and participants, but it does not create CalendarContainer or CalendarEvent rows.

There is no synchronization of:

- site start/end date;
- plan parts;
- participant assignments;
- reminders;
- event groups;
- Calendar share links.

Calendar’s LinkedModule field could represent this in the future, but no bridge exists.

### 15.14 Event and Chat integration

Events topics are a separate discussion implementation.

No EventSite action:

- creates a Chat;
- grants a Chat to access-link recipients;
- uses Chat encryption;
- links topic IDs to conversation IDs.

Chat ScopeType event remains a label.

### 15.15 Event and Parish integration

The Events system has no ParishId or ParishRoleId. The global Events administrator owns all sites.

A parish can publish separate content in ParishSiteConfig, but it cannot own an EventSite through the central role graph.

### 15.16 Events assessment

What is realized well:

- flexible database-driven content composition;
- public/internal page distinction;
- precise per-link page grants;
- useful form identity roles;
- token generation uses a CSPRNG;
- link rotation/revocation;
- public image behavior is explicit;
- legacy migration routes are kept reachable.

What is incomplete or unsafe:

- sensitive participant cards are plaintext;
- registrations/contacts/topics are plaintext;
- bearer tokens are plaintext and do not expire;
- first-open is mislabeled as contact verification;
- one first-claim global admin;
- missing CSRF;
- nearly no ledger coverage;
- no Calendar/Chat/Parish business integration;
- legacy and new event domains duplicate concepts;
- legacy frontend includes compile-time TypeScript errors.

---

## 16. Frontend integration

### 16.1 SPA and routing

The SPA uses HashRouter. App.tsx manually:

- reads location.pathname;
- splits path segments;
- identifies many route families;
- normalizes legacy Cogita paths;
- chooses lazy-loaded page components.

Only account, /cg, and /library are in the central protected-route set.

Other authenticated pages generally:

- render their page;
- call the API;
- react to 401/403;
- or contain public and authenticated branches in the same route.

This is workable, but route authorization is distributed and difficult to audit.

### 16.2 Central API client

[frontend/src/lib/api.ts](frontend/src/lib/api.ts):

- defaults API base to https://api.recreatio.pl;
- sends credentials with every request;
- adds JSON Content-Type unless using FormData;
- adds the CSRF header when a token is available;
- throws ApiError containing raw response text;
- defines handwritten request/response types for every module;
- contains 8,782 lines.

There is no generated OpenAPI client and no runtime schema validation. Backend and frontend contracts can drift without a compile-time cross-project boundary.

### 16.3 Authentication context

The frontend:

- obtains/refreshes a CSRF token;
- derives H3 with WebCrypto;
- sends H3 to auth endpoints;
- stores no raw password in the API layer;
- relies on HttpOnly auth cookie;
- calls /auth/me for session state.

Because /auth/me validates the database Session while many features do not, the frontend can conclude the user is logged out while a copied cookie still has backend authority on other paths.

### 16.4 Module pages

The focus module pages are lazy loaded:

- ParishPage;
- ChatPage, ChatPublicPage, ChatInvitePage;
- CalendarPage;
- HortusPage and Hortus admin panel;
- EventsPage and its editor/views.

The build is partially code-split. The build output still reports:

- Cogita chunk around 1.13 MiB minified;
- Events page chunk around 480 KiB;
- Parish chunk around 279 KiB;
- generic/vendor chunks around 300–340 KiB.

Vite warns that at least one chunk exceeds 500 KiB.

### 16.5 Build versus type-check

The npm build script is:

~~~text
vite build
~~~

It does not invoke TypeScript type-checking.

Current verification:

- Vite production build: succeeds;
- modules transformed: 489;
- Pyodide emits browser-externalization warnings for Node built-ins;
- separate TypeScript no-emit check: fails with 197 errors.

Selected error concentration:

- 32 in CogitaDependencyEdit;
- 27 in CogitaNotionSearch;
- 19 in CalendarPage;
- 14 in CogitaLiveHostWall;
- 11 in CogitaLiveRevisionJoin;
- 9 in ParishPage;
- 9 in central role-graph networking;
- additional errors in API types, account UI, and legacy Events.

Examples affecting the focus area:

- Calendar React Flow node/edge generic types are inconsistent;
- Parish references a candidate goal property not present in the frontend contract and has unused state;
- role recovery caller sends sharedRoleIds while the API wrapper expects sharedWithRoleIds;
- a legacy Forms event page calls an undefined setResponseIdx;
- react-katex has no declaration file.

The production bundle succeeding does not mean the TypeScript source is type-correct.

---

## 17. Database and schema lifecycle

### 17.1 One large DbContext

[RecreatioDbContext.cs](backend/Recreatio.Api/Data/RecreatioDbContext.cs) contains all platform DbSets:

- account, role, keys, shares, recovery, ledgers;
- Parish;
- multiple legacy event domains;
- Hortus;
- Cogita and Cogita Core/Game;
- Chat;
- Calendar;
- Cg;
- Library;
- Forms;
- composable Events.

This is a single transactional database boundary, but not necessarily a clean bounded-context boundary.

### 17.2 SQL Server configuration

EF Core uses SQL Server with compatibility level 120.

Compatibility level 120 corresponds to an older SQL Server feature set and limits which newer SQL functions/query translations can safely be used.

### 17.3 Schema provisioning mechanisms

Three mechanisms coexist:

1. [schema.sql](backend/Recreatio.Api/Sql/schema.sql)
   - labeled for a fresh install;
   - drops all known foreign keys and many tables;
   - recreates a broad schema;
   - destructive by design;
   - includes Chat, Calendar, and Hortus;
   - does not include the current composable EventSite tables.
2. EF migration 20260623230232_AddFormsTables
   - despite its name, creates a very large portion of the platform;
   - contains Chat and Calendar;
   - does not contain current Hortus or composable EventSite entities;
   - model snapshot is likewise stale for those areas.
3. manual patches
   - patch_hortus.sql;
   - patch_events.sql;
   - patch_forms.sql;
   - multiple Confirmation patches;
   - Cogita, Library, Rowerowa, and other patches.

There is no automatic Database.Migrate call at startup.

### 17.4 Missing Calendar patch

Calendar’s schema-outdated error says:

~~~text
Apply backend/Recreatio.Api/Sql/patch_calendar_schema.sql
~~~

No such file exists in the repository.

Calendar definitions are present in schema.sql and the broad EF migration, but the operator instruction for updating an existing database points to a nonexistent artifact.

### 17.5 Migration drift

The migration and model snapshot do not describe every current DbSet. That means:

- dotnet ef migrations add against the snapshot can generate unexpectedly broad changes;
- a database created only by the migration lacks current Hortus/Events tables;
- a database created only by schema.sql lacks current composable Events tables;
- deploying requires undocumented ordering of bootstrap plus patches;
- endpoint code includes runtime “schema outdated” fallbacks because schema state cannot be assumed.

### 17.6 Fresh-install versus upgrade risk

schema.sql starts by dropping all known foreign keys and tables. It must not be used as an upgrade script against data that must be preserved.

Patch files are mostly intended to be idempotent, but the repository has no single manifest that says:

- which scripts a database has applied;
- required order;
- current schema version;
- rollback behavior;
- minimum compatible API version.

### 17.7 Constraints

Useful constraints/indexes exist:

- unique login and session IDs;
- unique role/data grant combinations;
- Chat conversation sequence;
- Chat and Calendar code hashes;
- Calendar reminder occurrence uniqueness;
- graph execution idempotency;
- Hortus resource/time indexes and reservation code;
- Event link token;
- PortalAdminAssignment scope.

Missing or insufficient constraints include:

- unique serialized ledger head/sequence;
- Hortus occupancy/capacity enforcement;
- Calendar no-overlap enforcement;
- cross-module foreign keys for Chat scope and Calendar links;
- token hashing for Event/Parish capabilities;
- optimistic row versions for many high-contention aggregates.

---

## 18. Background and asynchronous behavior

### 18.1 Hosted services that actually run

Only two BackgroundService implementations were found and registered.

#### Calendar reminder dispatcher

Described in detail in the Calendar section. It polls, discovers due occurrences, creates dispatch rows, delivers webhooks, and retries.

#### Cogita game retention cleanup

GameRetentionCleanupHostedService:

- waits 2 minutes after startup;
- runs every hour;
- deletes presence state older than 24 hours;
- deletes location audit rows older than 30 days;
- logs removal count or errors.

It loads matching rows and removes them through EF, rather than using a set-based ExecuteDelete operation. Large retention backlogs can cause high memory use and large change trackers.

### 18.2 SignalR

SignalR is registered globally. The mapped hub is:

- /hubs/cogita-game.

Chat does not use SignalR. Calendar reminders do not push to users through SignalR. Parish and Events have no hub integration.

### 18.3 Work that is not backgrounded

The following occur inline in HTTP requests:

- Chat history re-encryption;
- ledger append/signing;
- Parish import/merge operations;
- Calendar graph execution triggered by endpoints;
- Event deep deletion;
- Event image upload to SQL;
- generic encrypted file upload;
- Hortus availability evaluation;
- public-link last-used updates.

Long or failure-prone operations do not have a durable job queue.

### 18.4 Missing operational jobs

No worker was found for:

- expired/revoked Session cleanup;
- expired public-link cleanup;
- role-key cache expiry;
- DataItem orphan cleanup;
- old Chat key-version cleanup;
- email/SMS/push/in-app Calendar delivery;
- Parish SMS delivery;
- Hortus notifications;
- Event invitations;
- ledger external anchoring;
- database/schema health;
- failed-webhook dead-letter handling.

---

## 19. Existing Markdown specifications versus implementation

### 19.1 System_Prepare.md

Accurate at a conceptual level:

- ASP.NET Core and React/TypeScript;
- SQL Server and EF Core;
- H1/H2/H3/H4 chain;
- MasterKey idea;
- roles, data keys, shared views, ledgers;
- AES-GCM recommendation;
- UTC ledger timestamps.

Incorrect or not yet realized:

| Document statement | Current implementation |
|---|---|
| separate Domain/Application/Infrastructure/API projects | one backend project with folders |
| JWT or similar stateless token | protected cookie plus database session |
| server never stores H3 | H3 is inside protected auth ticket |
| MasterKey exists only for session/request | normal mode caches it; Secure Mode re-derives from cookie H3 |
| all sensitive data encrypted | module-dependent; much Parish/Hortus/Event plaintext |
| important actions in append-only ledgers | uneven coverage; database does not enforce append-only |
| SharedView decrypts wrapped role key | Calendar reader does not; Cogita has a fuller path |
| request-local and session caches with metadata cache | one unbounded secret dictionary plus per-call variables |
| RSA-4096 or ECC | RSA-2048 |

### 19.2 Login_and_Registration.md

Implemented:

- user salt;
- H3 sent from browser;
- H4 stored;
- fixed-time verifier;
- MasterKey derivation;
- normal/Secure Mode flag;
- password rewrapping;
- Auth ledger events;
- random sessions.

Contradictions/gaps:

- H3 is retained in the auth ticket;
- Secure Mode explicitly depends on that H3 claim;
- token is a cookie, not JWT-like bearer metadata only;
- revoked sessions are not uniformly checked;
- password change reissues a cookie for a revoked session;
- recovery does not perform actual loss recovery;
- SharedView use is module-specific and Calendar incomplete;
- login references are not consistently tied to a full key-ledger snapshot.

### 19.3 Roles_and_Keys.md

Implemented:

- MasterRole;
- role graph;
- encrypted role-key copies;
- DataKeys and grants;
- role fields;
- public signing/encryption keys;
- some SharedViews;
- Key ledger;
- normal/Secure Mode.

Different:

- implementation uses separate read/write/owner keys, not one RoleKey;
- rights in Chat and several modules use booleans or user assignments;
- no LRU, metadata cache, or explicit request cache service;
- no complete general key rotation/version lifecycle;
- no RootReadKey enum/value; TransferKey exists but broad root recovery is not implemented as documented;
- recovery state machine requires existing owner access;
- not every key creation/deletion is captured;
- Calendar SharedView does not use its role key;
- signatures use current role keys without version binding.

The statement “Access rights are enforced by keys, never by plain boolean flags” is false for Chat, Hortus, composable Events, and parts of Calendar/Parish.

### 19.4 Hortus_Reservations.md

This document closely matches its implementation. Its main omission is security/operations analysis.

### 19.5 Cogita documents

The Cogita documents contain:

- design vision;
- graph architecture;
- JSON import constraints;
- question constraints;
- visual system.

They should be treated according to document title:

- documents marked Draft or Design Thinking are product/design references;
- JSON constraint files closely describe active import behavior;
- cogita-graph.md is an architecture specification with migration goals;
- CogitaAim.md is a broad vision document and is not reliable proof of current code.

Cogita is a very large active implementation and shares the same core identity/key systems, but a complete Cogita audit is outside the primary module scope of this report.

### 19.6 Missing documentation

There is no equivalent current module document for:

- Chat;
- Calendar;
- Parish;
- composable Events;
- background workers;
- database deployment sequence;
- production key management;
- cross-module integration contracts.

This file fills the current-state gap but should not substitute for future per-module runbooks and threat models.

---

## 20. Is the integration done the right way?

### 20.1 What is right

At platform level:

- one identity can be reused;
- one API reduces distributed transaction and deployment complexity;
- SQL foreign keys can protect same-database relations;
- crypto primitives use established platform libraries;
- AES-GCM nonce/tag sizes are appropriate;
- many key wraps use object-specific AAD;
- random token generation is cryptographically strong;
- fixed-time comparison is used in important token/verifier paths;
- DTO validation and query caps are common;
- UTC is used consistently for cross-module timestamps.

At module level:

- Parish has a genuine role hierarchy and selective encrypted fields;
- Chat binds ciphertext to conversation/sequence/version;
- Calendar has the most complete use of central role keys and DataItems;
- Hortus models availability rather than treating it as a simple date list;
- Events separates public pages from per-recipient internal pages;
- background retention exists for location data;
- Calendar webhook payloads include an idempotency key and optional HMAC.

### 20.2 What is not right

The integration is not correct as a uniform security architecture because:

- authority has four incompatible forms: role-key reachability, boolean participant flags, user ScopeKey assignment, and bearer token;
- encryption roots differ per module without an explicit classification policy;
- cryptographic ledgers are optional and partial;
- DB sessions and auth cookies disagree;
- central CSRF exists but is not universally enforced;
- public token storage patterns are inconsistent;
- cross-module fields are descriptive rather than enforced;
- Parish renders a mock Calendar;
- Events duplicates Chat-like topics;
- Calendar creates unused SharedView crypto objects;
- schema provisioning cannot reproduce all current entities through one supported path.

### 20.3 Current integration maturity

| Layer | Maturity | Reason |
|---|---|---|
| shared hosting | high | all modules mapped and built in one API |
| shared frontend | high | route and API coverage exists |
| shared identity | medium-high | cookie works, but session revocation inconsistent |
| shared authorization | medium-low | central roles used only by some modules |
| shared encryption | medium-low | strong primitives, uneven adoption |
| shared audit | low-medium | strong core/Calendar/Parish calls, absent elsewhere |
| shared database lifecycle | low | bootstrap/migration/patch drift |
| cross-module business workflows | low | mostly labels, mocks, or duplicated domains |
| operational readiness | medium-low | builds, but type errors, missing jobs/runbooks/health |

---

## 21. Prioritized technical issues

Priority labels in this section express likely risk, not proof of exploit in production.

### 21.1 Critical / P0

#### P0-1: H3 in the authentication ticket

Impact:

- expands Data Protection compromise into user MasterKey compromise;
- contradicts Secure Mode guarantees;
- makes remember-me cookie contain a long-lived password-equivalent secret.

Required direction:

- redesign Secure Mode so the server does not retain H3 in a recoverable long-lived ticket;
- distinguish authentication verifier from key-unlock material;
- rotate/reprotect affected tickets after migration;
- enforce protected-at-rest Data Protection keys.

#### P0-2: revoked sessions remain authoritative on many endpoints

Impact:

- copied cookie can outlive logout/password-change revocation;
- UI session state and API authority disagree.

Required direction:

- validate Session row in CookieAuthentication OnValidatePrincipal or an authorization policy;
- reject and sign out revoked/missing sessions globally;
- add last-activity/expiry policy without a write on every read if performance requires throttling;
- test logout/password-change against every module.

#### P0-3: plaintext Event participant health/minor data

Impact:

- database disclosure exposes special-category and minor data;
- bearer-token disclosure exposes participant access;
- current implementation conflicts with its own entity warning.

Required direction:

- classify fields;
- encrypt participant-card payload and consent/clause snapshots with per-site or per-card DataKeys;
- wrap those keys to per-site owner/admin roles;
- hash link tokens;
- add expiry, rotation, access audit, and deletion policy;
- perform a GDPR/RODO-focused threat and retention review.

#### P0-4: missing CSRF on Parish, Hortus, Events admin mutations

Impact:

- authenticated browser actions can be triggered cross-site under suitable request conditions;
- cookie is SameSite=None.

Required direction:

- centralize antiforgery as endpoint metadata/filter/middleware;
- make authenticated unsafe methods opt-out rather than opt-in;
- test cross-origin form and fetch cases.

#### P0-5: ledger fork race

Impact:

- normal concurrent traffic can make verification fail;
- ledger order cannot be trusted as a single sequence.

Required direction:

- add monotonic sequence per ledger/partition;
- serialize head update in SQL with row locking or use a dedicated head row and serializable transaction;
- add unique ledger/sequence and preferably unique previous-head constraints;
- make business mutation and ledger append atomic where required.

### 21.2 High / P1

#### P1-1: Data Protection key-at-rest default

Repository defaults allow unprotected filesystem XML outside Development.

Production must:

- require certificate/key-vault protection;
- fail startup when missing;
- share ring securely across instances;
- back it up and rotate deliberately.

#### P1-2: sensitive request logging

Captured auth/account bodies can be logged without redaction in some error paths.

Required:

- never capture H3, password-change material, tokens, private keys, or plaintext protected data;
- use structured allowlisted fields;
- add log retention/access controls.

#### P1-3: Calendar webhook SSRF and secret storage

Required:

- restrict schemes to HTTPS in production;
- resolve and reject loopback/link-local/private/metadata addresses;
- revalidate after redirects or disable redirects;
- allowlist hosts where possible;
- encrypt webhook secrets/headers;
- add terminal retry/dead-letter behavior and worker lease.

#### P1-4: Event and Parish plaintext capability tokens

Required:

- store hashes only;
- use fixed-time comparison;
- add expiry/revocation;
- rotate existing tokens;
- avoid returning full token lists after initial creation.

#### P1-5: Hortus double-booking race

Required:

- serialize availability decision and insert;
- introduce occupancy rows/locks or a database-enforced slot model;
- add concurrency tests with simultaneous confirmations.

#### P1-6: read key used as write authority in Parish

Required:

- define precise read/write/manage/owner matrix;
- require WriteKey for business mutation;
- require OwnerKey for role/key/administrator operations;
- add negative permission tests.

#### P1-7: Calendar SharedView incomplete

Required:

- either complete the view-role/DataKey path;
- or remove the unused role/key scaffolding and document it as a normal hashed public link.

Keeping decorative cryptography creates a false security impression.

#### P1-8: Chat invite role injection

Required:

- require the joining user to possess the requested RoleId;
- or restrict RoleId assignment to Chat managers;
- audit invite-link history access expectations.

#### P1-9: schema lifecycle drift

Required:

- choose EF migrations or a versioned SQL migration runner as the authoritative path;
- generate a baseline including Hortus and composable Events;
- add the missing Calendar upgrade;
- record schema version;
- test empty-database and upgrade deployment in CI.

#### P1-10: no true recovery

Required:

- define whether the feature is approval, escrow, or lost-key recovery;
- implement reconstruction and rewrapping if true recovery is intended;
- ensure initiation works without already having target owner keys;
- bind and validate approval cryptography, not only store opaque blobs.

### 21.3 Medium / P2

- TypeScript has 197 errors and is not checked by the production build.
- no automated backend/frontend test projects were found.
- Swagger is always enabled.
- health does not verify dependencies.
- session/key caches have no expiry or size limit.
- all RoleEdges are loaded for uncached requests.
- global ledger verification loads all rows into memory.
- Parish and API client files are too large for safe review.
- Chat long polling creates repeated database load.
- history re-encryption is synchronous.
- Calendar orphaned protected DataItems can accumulate.
- no expired-token/session cleanup.
- disabled Calendar channels create rows but no delivery path.
- Event images increase SQL size.
- PortalAdminAssignment supports one user, not organization delegation.
- first-user claim flows need explicit bootstrap authorization.
- module-specific errors and contracts are inconsistent.
- linked-module fields lack referential integrity.
- no production readiness check validates required secrets.

---

## 22. Recommended target integration

The following is a direction, not a description of current behavior.

### 22.1 Common authority

Use the central role graph for all authenticated administration:

- Parish owns Parish roles;
- EventSite has OwnerRoleId and optional admin/editor/viewer bindings;
- HortusPlace has OwnerRoleId and bindings;
- Chat participant role grants derive from explicit source-module roles;
- Calendar remains role-based.

User-based PortalAdminAssignment should be retained only as a bootstrap mechanism, then converted to role ownership.

### 22.2 Common sensitive-data envelope

Classify fields:

- public;
- operational metadata;
- personal;
- special category/health;
- secret/capability.

Then enforce:

- public: plaintext where intended;
- personal: DataKey envelope;
- special category: per-subject/per-record DataKey, restricted role grants, access audit;
- capability: random secret, stored only as hash;
- integration secret: encrypted secret store, never free JSON.

### 22.3 Explicit business links

Introduce bridge records or outbox-driven projections:

- ParishMass -> CalendarEvent;
- ParishConfirmationEvent -> CalendarEvent;
- EventSite/plan item -> CalendarEvent;
- HortusReservation -> CalendarEvent, if a unified schedule is desired;
- Parish/Event owner role -> Chat participant;
- EventSite -> Chat or Topics decision, not both implicitly.

Every bridge must define:

- source of truth;
- create/update/delete behavior;
- conflict behavior;
- authorization source;
- idempotency key;
- failure/retry handling.

### 22.4 Transactional outbox

For cross-module and external work:

1. mutate source business state;
2. append domain audit record;
3. write outbox item in one SQL transaction;
4. background worker projects Calendar/Chat/notifications;
5. use idempotency keys;
6. retain/retry/dead-letter.

This would remove fragile inline coupling and improve webhook/notification reliability.

### 22.5 Ledger redesign

A reliable ledger should have:

- LedgerId/PartitionId;
- Sequence;
- PreviousHash;
- entry ID;
- canonical payload bytes;
- subject/tenant/module identifiers in the hash;
- signer public-key fingerprint/version;
- transaction ID/correlation ID;
- unique partition/sequence;
- serialized head update;
- database append-only permissions or triggers;
- periodic external anchor.

The ledger should not be used as a substitute for normal business history tables or an outbox.

---

## 23. Recommended implementation order

### Phase 0: stop the largest exposure

1. Enforce database Session validation globally.
2. Remove/redesign H3 in authentication tickets.
3. Require encrypted Data Protection keys outside Development.
4. Add CSRF enforcement to all authenticated unsafe methods.
5. Encrypt Event participant cards and hash Event/Parish tokens.
6. remove secret-bearing request-body logging.

### Phase 1: make builds and schema reproducible

1. Add TypeScript no-emit checking to the build pipeline.
2. Fix focus-module type errors first.
3. Create backend unit/integration test projects.
4. establish one migration authority;
5. add current Hortus/Events/Calendar migrations;
6. add empty-database and upgrade CI jobs;
7. add readiness checks.

### Phase 2: make authorization consistent

1. Replace Parish read-key write checks.
2. migrate Hortus and Event admins to roles.
3. fix Chat invite role validation.
4. document role-to-action matrices.
5. add permission-denial integration tests.

### Phase 3: make audit reliable

1. serialize ledger appends;
2. add sequence/partition identity;
3. atomically combine business and audit writes;
4. cover Chat, Hortus, and Events;
5. expose Parish verification;
6. pin signer key versions;
7. add external anchors if tamper evidence is a real requirement.

### Phase 4: implement actual business integration

1. choose the central Calendar source/projection model;
2. replace Parish calendar mock;
3. connect EventSite plan/date to Calendar;
4. decide whether Event topics migrate to Chat or remain separate;
5. validate Chat scope against source modules;
6. add source-role participant synchronization;
7. connect notifications through an outbox.

### Phase 5: scale and maintain

1. split large endpoint/page files;
2. replace the handwritten 8,782-line API client with generated contracts or smaller domain clients;
3. add cache limits/expiry;
4. optimize key-ring graph loading;
5. move Chat to SignalR or another event channel;
6. background large re-encryption/import/delete work;
7. add multi-instance worker leases.

---

## 24. Verification performed for this report

### 24.1 Backend

Command:

~~~text
dotnet build backend/Recreatio.Api/Recreatio.Api.csproj --nologo
~~~

Result:

- successful;
- zero warnings;
- zero errors.

### 24.2 Frontend bundle

Command:

~~~text
npm run build
~~~

Result:

- successful Vite production bundle;
- 489 modules transformed;
- Pyodide Node-builtin externalization warnings;
- oversized Cogita chunk warning.

### 24.3 Frontend type-check

Command:

~~~text
tsc --noEmit -p frontend/tsconfig.json
~~~

Result:

- failed;
- 197 TypeScript errors.

### 24.4 Tests

No backend test project or recognizable frontend test suite was found in the audited repository.

No runtime database migration, endpoint smoke test, browser test, or production-host test was performed.

---

## 25. Operational configuration checklist

Before a deployment is treated as secure or recoverable, verify all of the following outside the repository:

### Secrets and crypto

- Crypto.ServerMasterSalt is valid Base64, random, stable, backed up, and not shared with non-production.
- Data Protection uses certificate/key-vault protection.
- RequireCertificateOutsideDevelopment is true.
- Data Protection ring is on persistent shared storage for multi-instance hosting.
- ring backup and restore have been tested.
- Calendar webhook global signing secret is configured if used.
- webhook per-reminder secrets are migrated out of plaintext JSON.

### Authentication

- cookie domain and SameSite behavior match actual frontend/API hosts;
- Secure cookie behavior works in local/test environments;
- Session revocation is globally enforced;
- remember-me lifetime matches risk policy;
- account lockout and salt enumeration are accepted/documented.

### Database

- exact migration/script version is recorded;
- Hortus and composable Events patches are applied;
- Calendar schema matches all current columns/tables;
- database backup includes SQL-stored Event images;
- destructive schema.sql is not used for upgrades;
- SQL compatibility level 120 is intentional;
- indexes and unique constraints match the current EF model.

### Storage

- secure-file-store is persistent and backed up;
- directory permissions restrict API-only access;
- blob restore is tested with matching database/DataKeys.

### Workers

- only one or coordinated Calendar dispatcher runs;
- receiver honors X-Recreatio-Idempotency-Key;
- retry volume is monitored;
- failed dispatch rows have an operational review process;
- Cogita retention cleanup is observed after startup.

### Logs

- auth/account request bodies are not retained;
- logs have restricted access and retention;
- webhook errors do not store remote secrets;
- PII is not included in structured logging.

---

## 26. Appendix A: focus-module table inventory

### Core security tables

- UserAccounts
- Sessions
- Roles
- RoleFields
- RoleEdges
- Memberships
- Keys
- DataItems
- DataKeyGrants
- PendingDataShares
- PendingRoleShares
- SharedViews
- RoleRecoveryShares
- RoleRecoveryKeys
- RoleRecoveryRequests
- RoleRecoveryApprovals
- AuthLedger
- KeyLedger
- BusinessLedger

### Parish

- Parishes
- ParishSiteConfigs
- ParishLedger
- ParishIntentions
- ParishOfferings
- ParishMasses
- ParishMassRules
- ParishConfirmationSmsTemplates
- ParishConfirmationCandidates
- ParishConfirmationPhoneVerifications
- ParishConfirmationMeetingSlots
- ParishConfirmationMeetingLinks
- ParishConfirmationMeetingJoinRequests
- ParishConfirmationMessages
- ParishConfirmationNotes
- ParishConfirmationCelebrations
- ParishConfirmationCelebrationParticipations
- ParishConfirmationCelebrationJoins
- ParishConfirmationEvents
- ParishConfirmationEventJoins

### Chat

- chat.ChatConversations
- chat.ChatConversationParticipants
- chat.ChatConversationKeyVersions
- chat.ChatMessages
- chat.ChatConversationReadStates
- chat.ChatPublicLinks

### Calendar

- calendar.Calendars
- calendar.CalendarRoleBindings
- calendar.CalendarEventGroups
- calendar.CalendarEventGroupShareLinks
- calendar.CalendarEvents
- calendar.CalendarEventGraphLinks
- calendar.CalendarEventRoleScopes
- calendar.CalendarEventReminders
- calendar.CalendarEventShareLinks
- calendar.CalendarScheduleGraphs
- calendar.CalendarScheduleGraphNodes
- calendar.CalendarScheduleGraphEdges
- calendar.CalendarGraphExecutions
- calendar.CalendarSharedViewLinks
- calendar.CalendarReminderDispatches

### Hortus

- hortus.HortusPlaces
- hortus.HortusResources
- hortus.HortusReservations
- hortus.HortusReservationItems
- hortus.HortusReservationStatusLogs

### Composable Events

- events.EventSites
- events.EventPages
- events.EventParts
- events.EventPartFields
- events.EventRegistrations
- events.EventRegistrationValues
- events.EventImages
- events.EventAccessLinks
- events.EventAccessLinkPages
- events.EventAccessLinkAssignments
- events.EventParticipantCards
- events.EventTopics
- events.EventTopicMessages

EventTopicMessage is declared in the same source file as EventTopic, which is why the Events data folder has 12 files for 13 mapped entity types.

---

## 27. Appendix B: endpoint capability overview

### Authentication

- issue CSRF token;
- register;
- retrieve salt;
- check login availability;
- login;
- password change;
- logout;
- change Secure Mode;
- current session.

### Core account/roles

- profile;
- role graph/list/create/fields;
- generic protected data and files;
- role access/parent relationships;
- role and data sharing;
- pending-share acceptance;
- ledger verification;
- recovery activation/request/approve/cancel/complete.

### Parish

- public parish catalogue/site;
- public intentions and Masses;
- candidate registration and phone verification;
- meeting availability/book/release/resign/join/decision;
- candidate portal/messages/goals/index/celebration/event joins;
- parish creation and site configuration;
- candidate list/export/import/merge/edit;
- meeting slot management;
- admin messages/notes;
- celebrations and events;
- intention, Mass, rule, and offering operations.

### Chat

- list/create/detail conversations;
- list/poll/send/read messages;
- add/remove participants;
- create/open/poll public links;
- post public questions;
- create/open/poll/join invite links.

### Calendar

- list/create/update calendars;
- add/remove role bindings;
- get/create/update/delete/query events;
- conflicts;
- basic event share links;
- public calendar/event readers;
- graph get/upsert/execute;
- task completion;
- dispatch history;
- event SharedViews;
- groups and weekly series;
- viewer scopes;
- group SharedViews.

### Hortus

- place/resource public data;
- availability;
- dry-run check;
- request submission/status/cancel;
- admin status/claim/bootstrap;
- reservation list/timeline/check/create/decision;
- resource create/update/delete;
- place settings.

### Composable Events

- catalogue/public site/form submit;
- recipient link page;
- admin status/claim;
- site/page/part/field CRUD and reorder;
- registration list/hide/delete;
- access-link list/create/update/status/rotate/delete;
- import/export-style site operations;
- image operations;
- participant registration/card operations;
- topic/message operations.

---

## 28. Appendix C: cryptographic artifact map

| Artifact | Generation | At-rest protection | Decrypted by |
|---|---|---|---|
| UserSalt | browser random 32 bytes | plaintext account column | browser receives it |
| H3 | PBKDF2 plus two hashes | protected auth cookie claim; not DB column | auth/key-ring server |
| StoredH4 | SHA-256(H3) | plaintext verifier bytes in DB | auth server |
| MasterKey | PBKDF2(H3, server salt plus user ID) | RAM cache only, but re-derivable from cookie H3 | key-ring server |
| Role read/write/owner keys | server random 32 bytes | AES-GCM under MasterKey, membership key, or parent role key | key-ring server |
| Role private RSA keys | RSA-2048 | AES-GCM under owner key | role crypto server |
| DataKey | server random 32 bytes | AES-GCM under role read key | data reader/writer server |
| Generic DataItem value | caller plaintext | AES-GCM under DataKey | authorized API path |
| Encrypted file chunks | upload bytes | AES-GCM under DataKey | authorized API path |
| Chat conversation key | server random 32 bytes | ASP.NET Data Protection | Chat API |
| Chat message | supplied text | AES-GCM under conversation key | Chat API |
| Parish confirmation payload | serialized candidate | ASP.NET Data Protection | Parish API |
| Parish intention internal/donor | supplied text | AES-GCM under parish DataKey | Parish API with role key |
| Parish offering amount/donor | supplied values | AES-GCM under offering DataKey | Parish API with role key |
| Calendar protected details | supplied JSON | AES-GCM under DataKey; grant under owner read key | Calendar API with grant |
| Calendar completion proof | supplied JSON | same DataItem envelope | Calendar API with grant |
| Calendar SharedView role key | random 32 bytes | PBKDF2-derived SharedViewKey | currently not used by public reader |
| Chat public/invite code | random 18 bytes | SHA-256 hash | Chat resolver |
| Calendar share code | random | SHA-256 hash | Calendar resolver |
| Hortus requester token | random 24 bytes | SHA-256 hex | Hortus resolver |
| Event access token | random 24 bytes | plaintext | Event resolver/admin |
| Parish public tokens | random/short codes | plaintext | Parish resolver/admin |
| Ledger entry hash | SHA-256 chain | plaintext hash bytes | verifier |
| Ledger signature | RSA-PKCS1-SHA256 | plaintext signature bytes | verifier with current role public key |

---

## 29. Appendix D: current guarantees and non-guarantees

### The current implementation can reasonably claim

- the original user password is not sent to the API;
- H4, not the original password, is stored as verifier;
- central protected values use authenticated encryption;
- Chat message ciphertext is bound to conversation/sequence/version;
- generic file chunks are encrypted and position-bound;
- many public codes are generated with secure randomness;
- Hortus and Chat/Calendar hashed-code patterns resist direct database token reuse;
- role keys are not stored in plaintext database columns;
- the backend and Vite bundle currently build;
- Calendar webhook delivery is retried with an idempotency key;
- Cogita location data has an implemented retention worker.

### The current implementation must not claim without qualification

- end-to-end encrypted Chat;
- zero-knowledge server;
- server never retains H3;
- Secure Mode without persistent unlock material;
- immediate global logout/session revocation;
- all sensitive data encrypted at rest;
- all permissions enforced cryptographically;
- all business actions ledgered;
- ledger is fork-free or externally tamper-proof;
- exactly-once reminders;
- complete SharedView cryptographic access in Calendar;
- Parish/Chat/Calendar/Hortus/Event business integration;
- race-free booking/conflict enforcement;
- reproducible database creation from one migration path;
- type-safe frontend;
- comprehensive automated test coverage.

---

## 30. Final current-state statement

ReCreatio today is a broad, actively implemented modular monolith. Its central security foundation is more sophisticated than a conventional role-column application: it has password-derived MasterKeys, separate role read/write/owner keys, encrypted key propagation, DataKey grants, AES-GCM payloads, RSA signatures, SharedView structures, and hash-chain ledgers.

That foundation is real, but it is not the universal foundation of every module:

- Parish uses it partially and mixes it with Data Protection and plaintext tokens;
- Chat uses it to resolve role identity but uses server-held conversation keys and boolean permissions;
- Calendar uses it most deeply, while leaving public metadata plaintext and SharedView decryption unfinished;
- Hortus uses a user assignment and hashed requester capability, outside the role/key ledger system;
- composable Events uses a global user assignment and plaintext bearer links, and stores its most sensitive participant data unencrypted.

The modules are currently integrated as software components, not yet as one coherent business-security model. The next phase should not begin with more cross-module UI. It should first make identity revocation, H3 handling, CSRF, sensitive-data encryption, schema migration, and ledger serialization trustworthy. Once those foundations are consistent, Calendar projections, source-bound Chats, Parish-owned Events, and unified notifications can be added without multiplying incompatible security behavior.

That is the actual technical situation represented by the audited working tree on 2026-08-22.
