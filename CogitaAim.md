diff --git a/docs/cogita-rebuild-recap-and-questions.md b/docs/cogita-rebuild-recap-and-questions.md
new file mode 100644
index 0000000000000000000000000000000000000000..a1947fb67d7d37a94119670a43c696be6b5ee474
--- /dev/null
+++ b/docs/cogita-rebuild-recap-and-questions.md
@@ -0,0 +1,1055 @@
+# Cogita — Final Post-Recreation Product Specification
+
+## Document metadata
+- Status: Canonical target-state specification.
+- Language: English.
+- Scope: Final resulting Cogita product behavior and structure.
+- Non-goal: No migration or phased implementation strategy.
+
+---
+
+## Executive Spec Index
+
+This document is intentionally structured into exactly **three master parts**:
+
+1. **Part I — Data, Domain Model, and Cryptography**
+   - Canonical entities.
+   - Knowledge Item and Card model.
+   - Knowness and dependency semantics.
+   - Cryptographic and hashing approach.
+
+2. **Part II — Backend Structure Linking Frontend and Database**
+   - Runtime and API contracts at a structural level.
+   - Role and access boundaries.
+   - State, events, statistics, and persistence behavior.
+
+3. **Part III — Frontend Product Structure**
+   - Full hierarchy.
+   - Display model taxonomy.
+   - Page-by-page functionality with display type.
+
+Normative words in this spec:
+- **MUST** = mandatory requirement.
+- **SHOULD** = recommended default behavior.
+- **MAY** = optional, implementation choice.
+
+---
+
+# Part I — Data, Domain Model, and Cryptography
+
+## I.1 Product identity and domain boundaries
+
+1. Cogita **MUST** function as a standalone-domain-ready application while still being embeddable inside Recreatio navigation.
+2. Cogita **MUST** expose both unlogged and logged user experiences.
+3. Workspace **MUST** be modeled as a dedicated mode of Cogita, not as the entire product.
+4. Runtime execution pages **MUST** exist outside workspace hierarchy paths.
+
+## I.2 Canonical terminology
+
+1. “Info” is deprecated and **MUST** be replaced by **Knowledge Item**.
+2. “Checkcard / Checking Card” is deprecated and **MUST** be replaced by **Card**.
+3. “Core revision/runtime” label is deprecated and **MUST** be replaced by canonical **Revision/Runtime** language.
+
+## I.3 Logical entity families
+
+Cogita data model **MUST** include at least these logical families:
+1. Access and role.
+2. Library.
+3. Knowledge Item.
+4. Card.
+5. Dependency.
+6. Collection.
+7. Revision template.
+8. Runtime execution.
+9. Live session.
+10. Storyboard.
+11. Writing.
+12. Knowness/statistics.
+
+## I.4 Library
+
+A library is the top structural data container in Cogita.
+
+A library **MUST** support:
+1. Private ownership.
+2. Role-based read sharing.
+3. Scoped subset publication (e.g., selected revision/storyboard scope).
+
+A library **SHOULD** support aggregated indicators:
+- item counts,
+- card counts,
+- revision usage,
+- knowness coverage.
+
+## I.5 Knowledge Item
+
+Knowledge Item is the canonical semantic content entity.
+
+Each Knowledge Item **MUST** include:
+1. Identity metadata.
+2. Type/schema metadata.
+3. Payload section for single-use fields.
+4. Link/reference section to other knowledge items.
+5. Derived card metadata (0..N cards).
+
+### I.5.1 Payload principle
+Fields that are local-only and not used as cross-item selectors **MUST** be stored in item payload.
+
+### I.5.2 Link/reference principle
+Fields linking to other knowledge items **MUST** use encrypted link storage and deterministic hash indexing for performant relation lookup.
+
+## I.6 Cards
+
+Cards are generated from knowledge items and power revision checks.
+
+Card cardinality per item:
+- 0 cards,
+- 1 card,
+- N cards.
+
+Cards **MUST** be addressable from:
+- workspace management,
+- revision runtime,
+- statistics and knowness views.
+
+## I.7 Correctness entries
+
+Correctness entry **MUST** include:
+1. Outcome class (`correct`, `wrong`, `blank_timeout`).
+2. Delay/response duration dimensions.
+3. Timestamp.
+4. Participant context.
+5. Character-level comparison result for answer diagnostics.
+
+Character-level comparison **SHOULD** produce machine-usable mismatch traces.
+
+## I.8 Knowness model
+
+Knowness is a backend-computed signal attached to person/entity context.
+
+Knowness snapshots **MUST** be refreshed when a new correctness entry is written for the related person/entity.
+
+Knowness **SHOULD** remain computationally lightweight and stable.
+
+### I.8.1 Lightweight formula policy
+The knowness behavior is governed by this function form:
+
+```js
+function knowledge(q1, d1, q2, d2, t) {
+  const T0 = 5 / 60; // 5 minutes in hours
+  const H = Math.max(
+    T0,
+    Math.pow(T0, 1 - q2) * Math.pow(12 * (d2 + q1 * d1), q2)
+  );
+  return Math.pow(10, 0.5 * (1 - t / H));
+}
+```
+
+Interpretation policy:
+- `q` = correctness quality terms,
+- `d` = delay terms,
+- `t` = elapsed time from last relevant question.
+
+Implementation policy:
+- final update **SHOULD** use up to the last three correctness entries when available.
+
+## I.9 Dependencies
+
+Dependencies are foundational and apply beyond runtime selection.
+
+Dependency relationships **MAY** exist:
+1. Between cards inside one knowledge item.
+2. Between knowledge items.
+3. Between collections.
+
+### I.9.1 Selection gating semantics
+If a revision has dependency mode enabled:
+- child cards **MUST** only be selected into stack when parent knowness threshold is met,
+- if a child is already in active stack, it **MUST NOT** be removed during the same stack cycle only because parent drops later.
+
+### I.9.2 Propagation semantics (authoritative)
+Propagation rule (requested clarification):
+- propagated amount = `childKnowness * impact`.
+- this propagated amount **MUST** be added to parent knowness.
+
+Consequences:
+1. If child correctness worsens, child knowness drops.
+2. Parent knowness **MUST** lose the corresponding propagated contribution.
+3. Child availability checks **MUST** re-evaluate against dependency gates when stack is rebuilt.
+
+## I.10 Collections
+
+Collection defines structured scope over knowledge/card space.
+
+Collection **MUST** carry a rule describing how content is selected.
+
+Collection rules **SHOULD** be extensible and support growth in selector logic.
+
+## I.11 Revisions
+
+Revision is a template specifying asking behavior.
+
+Supported revision types **MUST** include:
+1. Random fixed amount.
+2. Full stack random order.
+3. Level-based.
+4. Time-knowness (primary).
+
+Revision usage forms **MUST** include:
+- solo,
+- shared link,
+- group async,
+- group sync,
+- live session source.
+
+## I.12 Shared revision persistence policy
+
+Shared runs are temporary by nature, but now include requested recovery behavior.
+
+1. Shared run **MUST** support short-time token-based recovery.
+2. Recovery token **MUST** have explicit TTL.
+3. Recovery token **MUST** be temporary and non-long-term.
+4. Shared session data **SHOULD** remain ephemeral by default after expiration.
+
+## I.13 Group run semantics
+
+### I.13.1 Group async
+- participants **MAY** be one aggregate identity or multiple identities,
+- per-member distinction **SHOULD** feed statistics.
+
+### I.13.2 Group sync
+- group sync **MUST** allow multiple participants on one device,
+- active participant per question **MUST** be selectable.
+
+## I.14 Live wall data domain
+
+Participant wall and host wall **MUST** consume same canonical runtime truth model with role-filtered visibility.
+
+Participant wall **MUST NOT** expose privileged host-only reveal information.
+
+## I.15 Storyboard and writing domain status
+
+Storyboard and writing are first-class modules in final product shape.
+
+Both modules **MUST** integrate with Knowledge Item references and reuse shared entity components.
+
+## I.16 Cryptographic approach
+
+### I.16.1 Baseline objective
+The crypto model balances:
+1. confidentiality of sensitive fields,
+2. fast linking/retrieval,
+3. role-based access constraints.
+
+### I.16.2 Reference storage pattern
+For link/reference fields requiring confidential relations:
+- value **MUST** be stored encrypted,
+- deterministic hash **MUST** be stored for quick equality/filter lookups,
+- signature metadata **MAY** be stored where integrity provenance is required.
+
+### I.16.3 Hash boundary
+Deterministic hash usage **MUST** be scoped by library and field key boundaries to avoid accidental cross-domain collisions.
+
+### I.16.4 Access boundary
+Runtime and read operations **MUST** enforce role-based access before exposing linked data.
+
+---
+
+# Part II — Backend Structure Linking Frontend and Database
+
+## II.1 Integration principles
+
+1. Frontend **MUST** consume one canonical runtime contract for revision execution behavior.
+2. Backend **MUST** persist runtime truth through normalized run/participant/exposure/attempt/event model.
+3. DB read/write **MUST** remain role-gated by library access context.
+4. Knowness updates **MUST** happen in backend when correctness events are written.
+
+## II.2 High-level request flow
+
+1. UI triggers user action.
+2. Frontend calls Cogita API.
+3. Backend validates role/library access.
+4. Backend reads/writes canonical entities.
+5. Backend updates knowness/statistics projections.
+6. Backend returns normalized response.
+7. UI renders role-specific display state.
+
+## II.3 Runtime canonical model (structural)
+
+Runtime model **MUST** include:
+1. Run.
+2. Participant.
+3. Exposure.
+4. Attempt.
+5. Event stream.
+6. Knowness snapshots.
+7. Statistics projections.
+
+## II.4 Run lifecycle states
+
+Run state machine **MUST** support:
+- draft,
+- lobby,
+- active,
+- paused,
+- finished,
+- archived.
+
+Transition events **MUST** be auditable in normalized event stream.
+
+## II.5 Participant lifecycle
+
+Participant registration **MUST** include:
+- runtime participant identity,
+- display name,
+- host flag if applicable,
+- session connectivity markers.
+
+In shared mode, participant continuity **MUST** use short-lived recovery token policy (Part I.12).
+
+## II.6 Next-card selection behavior
+
+Selection engine **MUST** consume:
+1. revision mode,
+2. already answered rounds,
+3. knowness state,
+4. dependency gating (if enabled),
+5. participant seed/order policy.
+
+Selection response **SHOULD** include reason trace for explainability.
+
+## II.7 Attempt write behavior
+
+Attempt write operation **MUST**:
+1. write/update exposure state,
+2. write attempt entry,
+3. emit normalized event entries,
+4. update knowness snapshots,
+5. return reveal payload and score factors where relevant.
+
+## II.8 Reveal contract
+
+Reveal contract **MUST** include:
+- card identity,
+- participant answer view,
+- canonical answer view,
+- distribution summary where allowed,
+- score/knowness update signals.
+
+Role policy:
+- host may see richer reveal context,
+- participant view **MUST** remain policy-safe for fairness.
+
+## II.9 Statistics contract
+
+Statistics layer **MUST** support:
+1. per-run totals,
+2. per-participant summaries,
+3. outcome distributions,
+4. response-time metrics,
+5. timeline sequence,
+6. knowness/coverage aggregates for dashboard modules.
+
+## II.10 Shared recovery token contract (new mandatory)
+
+Shared recovery token **MUST** have:
+1. token ID.
+2. TTL expiration timestamp.
+3. run context binding.
+4. participant context binding.
+5. single-session replay safety rules.
+
+Shared recovery token **MUST NOT** survive beyond configured short-time window.
+
+## II.11 Dependency propagation contract (new mandatory)
+
+Backend knowness propagation **MUST** implement:
+
+`parentKnowness += childKnowness * impact`
+
+When child knowness decreases, parent propagated contribution **MUST** decrease accordingly.
+
+Eligibility checks **MUST** re-evaluate child visibility for next stack build.
+
+## II.12 API family structure
+
+Cogita API families (logical):
+1. libraries,
+2. knowledge items,
+3. cards,
+4. dependencies,
+5. collections,
+6. revisions,
+7. runtime runs,
+8. live sessions,
+9. storyboard,
+10. writing,
+11. statistics,
+12. dashboard personalization.
+
+## II.13 Dashboard personalization backend contract
+
+Backend **MUST** support persistent user preferences for:
+- enabled modules,
+- ordering/layout,
+- pinned entities,
+- default quick actions.
+
+Backend **SHOULD** support recommendation payload from recent activity signals.
+
+## II.14 Workspace context contract
+
+Entity endpoints **MUST** be reusable in both contexts:
+1. full workspace pages,
+2. lightweight foreground overlays in non-workspace pages.
+
+Responses **SHOULD** include sufficient metadata for either context rendering.
+
+## II.15 Search contract
+
+Search **MUST** support cross-entity queries across:
+- knowledge items,
+- cards,
+- collections,
+- revisions,
+- dependencies.
+
+Search **SHOULD** return compact result metadata plus context-open hints.
+
+## II.16 Access and publication backend contract
+
+Role-based access controls **MUST** support:
+1. private library access,
+2. explicit role read grants,
+3. scoped subset publication grants.
+
+Query-level filtering **MUST** enforce granted scope boundaries.
+
+## II.17 Persistence classes
+
+### II.17.1 Persistent classes
+- structural entities,
+- private runs,
+- group run records,
+- knowness snapshots,
+- statistics baselines,
+- dashboard preferences.
+
+### II.17.2 Temporary classes
+- shared run participant continuity tokens,
+- ephemeral shared run transient state.
+
+## II.18 Role-oriented live wall contract
+
+Host wall endpoints **MUST** allow:
+- control mode,
+- analytics mode,
+- presentation-safe output mode.
+
+Participant wall endpoints **MUST** be answer-centric and fairness-safe.
+
+---
+
+# Part III — Frontend Product Structure
+
+## III.1 Complete hierarchy
+
+Cogita hierarchy in final state:
+
+1. Cogita Root
+   - Public Home
+   - Logged Home Dashboard
+   - Workspace Mode
+   - Revision Mode
+   - Live Mode
+   - Storyboard Mode
+   - Writing Mode
+
+2. Workspace Mode hierarchy
+   - Libraries
+     - Library Overview
+     - Knowledge Item domain
+     - Card domain
+     - Dependency domain
+     - Collection domain
+     - Revision template domain
+     - Storyboard authoring domain
+     - Writing authoring domain
+     - Access/publication domain
+
+3. Runtime hierarchy (outside workspace)
+   - Revision execution pages
+   - Shared run pages
+   - Group async pages
+   - Group sync pages
+   - Live wall pages
+
+## III.2 URL policy
+
+1. Cogita root: `/cogita` (or standalone root when domain split is complete).
+2. Workspace pages **MUST** include `/workspace/` in URL.
+3. Revision execution pages **MUST** use revision-mode paths outside workspace.
+4. Live wall pages **MUST** use role/display-specific paths.
+
+Examples:
+- `/cogita/workspace/libraries/{libraryId}`
+- `/cogita/revision/solo/{revisionId}`
+- `/cogita/revision/shared/{shareCode}`
+- `/cogita/revision/group-sync/{revisionId}`
+- `/cogita/live/wall/participant/{sessionId}`
+- `/cogita/live/wall/host/{sessionId}`
+
+## III.3 Display model taxonomy
+
+### III.3.1 Model A — Public portal display
+Purpose: unlogged entry.
+
+### III.3.2 Model B — Logged portal dashboard display
+Purpose: configurable operational home.
+
+### III.3.3 Model C — Workspace display
+Purpose: structural management; includes sidebar + breadcrumb.
+
+### III.3.4 Model D — Revision fullscreen display
+Purpose: focused run execution with role-adaptive controls.
+
+### III.3.5 Model E — Live wall display
+Purpose: role-specific participant/host/output presentation surfaces.
+
+All models **MUST** support desktop and phone compatibility.
+
+## III.4 Logged home dashboard requirements
+
+Dashboard **MUST** include:
+1. Last revision shortcuts.
+2. Running session shortcuts.
+3. Continue-from-last-change suggestions.
+4. Large aggregate statistics panel.
+5. User module selection.
+6. User module ordering/placement.
+
+Dashboard modules **SHOULD** include:
+- pinned revisions,
+- recent edits,
+- suggested actions,
+- quick run launcher.
+
+## III.5 Workspace display requirements
+
+Workspace **MUST** provide:
+1. Sidebar hierarchy navigation.
+2. Top breadcrumb with absolute position.
+3. Entity canvas region.
+4. Structural context always visible.
+
+Workspace entity components **MUST** be reusable standalone components.
+
+Reusable components **MUST** support “Show in workspace” action when opened from non-workspace contexts.
+
+## III.6 Revision fullscreen requirements
+
+All revision modes **MUST** use fullscreen-first layout principles.
+
+Supported modes:
+1. solo,
+2. shared,
+3. group async,
+4. group sync.
+
+Group sync UI **MUST** support active participant switching per question.
+
+Shared UI **MUST** support short-time token recovery behavior when refresh/re-entry occurs within TTL.
+
+## III.7 Live wall requirements
+
+### III.7.1 Participant wall
+- answer-focused,
+- minimal non-essential data,
+- no privileged reveal leakage.
+
+### III.7.2 Host wall
+- host control mode,
+- statistics mode,
+- presentation-safe output mode launcher.
+
+### III.7.3 Presentation-safe output screen
+- hide privileged host information,
+- suitable for participant-facing projection.
+
+## III.8 Storyboard and writing UX placement
+
+Storyboard and Writing **MUST** exist as both:
+1. workspace authoring domains,
+2. user-facing execution/editing surfaces.
+
+Both **SHOULD** integrate knowledge item insertion and reference browsing.
+
+## III.9 Page catalog with display type and functionality
+
+### III.9.1 Root pages
+
+#### Public Home
+- Display: Model A.
+- Functions:
+  - explain product,
+  - login/register entry,
+  - open public share/join links.
+
+#### Logged Home Dashboard
+- Display: Model B.
+- Functions:
+  - configurable module board,
+  - quick continuation paths,
+  - aggregate statistics panel,
+  - quick run launch actions.
+
+#### Dashboard Module Manager
+- Display: Model B overlay.
+- Functions:
+  - enable/disable modules,
+  - reorder modules,
+  - persist preferences.
+
+### III.9.2 Workspace pages
+
+#### Workspace Home
+- Display: Model C.
+- Functions:
+  - hierarchy overview,
+  - maintenance and repair entry points.
+
+#### Library List
+- Display: Model C.
+- Functions:
+  - list accessible libraries,
+  - filter by ownership/sharing.
+
+#### Library Overview
+- Display: Model C.
+- Functions:
+  - structural summaries,
+  - access/publication controls.
+
+#### Access & Publication Panel
+- Display: Model C / overlay.
+- Functions:
+  - role read grants,
+  - subset publication scope management.
+
+#### Knowledge Item List
+- Display: Model C.
+- Functions:
+  - filter/sort,
+  - open editors.
+
+#### Knowledge Item Detail
+- Display: standalone component (Model C or overlay).
+- Functions:
+  - payload,
+  - references,
+  - generated cards,
+  - dependencies.
+
+#### Knowledge Item Editor
+- Display: standalone component.
+- Functions:
+  - payload edit,
+  - encrypted reference link edit,
+  - card generation preview.
+
+#### Card List
+- Display: Model C.
+- Functions:
+  - card inventory,
+  - source and state filters.
+
+#### Card Detail
+- Display: standalone component.
+- Functions:
+  - card/source mapping,
+  - correctness history summary,
+  - knowness summary.
+
+#### Dependency Graph List
+- Display: Model C.
+- Functions:
+  - list graphs,
+  - activate profile,
+  - open editor.
+
+#### Dependency Graph Editor
+- Display: Model C.
+- Functions:
+  - edge creation,
+  - impact weight configuration,
+  - parent-child semantics.
+
+#### Collection List
+- Display: Model C.
+- Functions:
+  - list collections,
+  - open details.
+
+#### Collection Detail
+- Display: standalone component.
+- Functions:
+  - rule display,
+  - scope result preview.
+
+#### Collection Rule Editor
+- Display: standalone component.
+- Functions:
+  - selector rule configuration,
+  - consistency validation.
+
+#### Revision Template List
+- Display: Model C (+ dashboard shortcuts).
+- Functions:
+  - list revisions,
+  - usage hints,
+  - pin favorites.
+
+#### Revision Template Detail
+- Display: standalone component.
+- Functions:
+  - mode settings,
+  - dependency option,
+  - share/live capabilities.
+
+#### Revision Template Editor
+- Display: standalone component.
+- Functions:
+  - configure type,
+  - configure ordering/count/knowness/dependency options.
+
+#### Revision Share Settings
+- Display: standalone component.
+- Functions:
+  - manage stable share link,
+  - configure short-time recovery token behavior.
+
+#### Storyboard Authoring
+- Display: Model C or focused authoring page.
+- Functions:
+  - sequence editing,
+  - media/effect wiring,
+  - progression checkpoints.
+
+#### Writing Authoring
+- Display: Model C or focused writing page.
+- Functions:
+  - long-form composition,
+  - citation/LaTeX handling,
+  - knowledge insertion.
+
+### III.9.3 Revision execution pages
+
+#### Solo Run Page
+- Display: Model D.
+- Functions:
+  - card ask loop,
+  - answer capture,
+  - reveal,
+  - progression.
+
+#### Shared Run Page
+- Display: Model D.
+- Functions:
+  - temporary shared session,
+  - short-time token recovery during TTL.
+
+#### Group Async Page
+- Display: Model D.
+- Functions:
+  - independent progression,
+  - cumulative and per-member metrics.
+
+#### Group Sync Page
+- Display: Model D.
+- Functions:
+  - synchronized flow,
+  - active participant switching.
+
+### III.9.4 Live pages
+
+#### Live Session List
+- Display: Model B / Model C bridge page.
+- Functions:
+  - list, create, join sessions.
+
+#### Live Join Page
+- Display: Model D/E hybrid entry.
+- Functions:
+  - code join,
+  - identity capture.
+
+#### Live Participant Wall
+- Display: Model E participant.
+- Functions:
+  - answer-centric wall.
+
+#### Live Host Wall
+- Display: Model E host.
+- Functions:
+  - host controls,
+  - statistics,
+  - safe output launcher.
+
+#### Live Safe Output
+- Display: Model E output.
+- Functions:
+  - participant-facing presentation stream without privileged host details.
+
+### III.9.5 Storyboard and writing runtime pages
+
+#### Storyboard Playback
+- Display: immersive learning mode.
+- Functions:
+  - directed exploration,
+  - guided progression,
+  - optional handoff to revision.
+
+#### Writing Editor Runtime
+- Display: focused writing mode.
+- Functions:
+  - project editing,
+  - citations,
+  - latex,
+  - knowledge references.
+
+## III.10 Overlay reuse model
+
+Entity components **MUST** be reusable in two contexts:
+1. full workspace page context,
+2. lightweight foreground overlay context.
+
+Overlay closure **MUST** return user to previous page state.
+
+## III.11 Device compatibility requirements
+
+### Desktop
+- multi-column where useful,
+- expanded context/analytics panels,
+- host multi-panel controls.
+
+### Phone
+- stacked layouts,
+- compact navigation,
+- fullscreen-first run/live interactions.
+
+Functional parity **MUST** be preserved.
+
+---
+
+# Consolidated Requirement Matrix (replacing repeated guarantees)
+
+The following IDs replace scattered repetitive guarantee sections.
+
+## RQ-01 Terminology
+- Requirement: Knowledge Item/Card/Revision canonical naming.
+- Type: MUST.
+- Defined in: I.2.
+
+## RQ-02 Workspace identity
+- Requirement: Structural pages include `/workspace/`.
+- Type: MUST.
+- Defined in: III.2.
+
+## RQ-03 Dashboard modularity
+- Requirement: User can select and reorder home modules.
+- Type: MUST.
+- Defined in: III.4.
+
+## RQ-04 Continuation shortcuts
+- Requirement: Last revision and running sessions shortcuts on logged home.
+- Type: MUST.
+- Defined in: III.4.
+
+## RQ-05 Huge statistics panel
+- Requirement: Large aggregate statistics module on logged home.
+- Type: MUST.
+- Defined in: III.4.
+
+## RQ-06 Workspace chrome
+- Requirement: Sidebar + breadcrumb + entity canvas.
+- Type: MUST.
+- Defined in: III.5.
+
+## RQ-07 Reusable entity components
+- Requirement: entities reusable in workspace and overlays.
+- Type: MUST.
+- Defined in: III.5, III.10.
+
+## RQ-08 Show in workspace
+- Requirement: overlay entity can open in workspace context.
+- Type: MUST.
+- Defined in: III.5, III.10.
+
+## RQ-09 Revision mode taxonomy
+- Requirement: solo/shared/group async/group sync supported.
+- Type: MUST.
+- Defined in: I.11, III.6.
+
+## RQ-10 Shared short token recovery
+- Requirement: shared flow has short-time token-based recovery with TTL.
+- Type: MUST.
+- Defined in: I.12, II.10, III.6.
+
+## RQ-11 Group sync participant switching
+- Requirement: active participant selection per question.
+- Type: MUST.
+- Defined in: I.13, III.6.
+
+## RQ-12 Live role separation
+- Requirement: participant-safe wall and host multi-mode wall.
+- Type: MUST.
+- Defined in: I.14, II.18, III.7.
+
+## RQ-13 Safe output mode
+- Requirement: host can open non-privileged participant-facing screen.
+- Type: MUST.
+- Defined in: III.7.
+
+## RQ-14 Knowledge Item payload/reference split
+- Requirement: single-use payload + encrypted linked references with deterministic hash.
+- Type: MUST.
+- Defined in: I.5.
+
+## RQ-15 Card generation cardinality
+- Requirement: one item can generate 0..N cards.
+- Type: MUST.
+- Defined in: I.6.
+
+## RQ-16 Correctness entry richness
+- Requirement: outcome, delay, timestamp, participant, char-level diagnostics.
+- Type: MUST.
+- Defined in: I.7.
+
+## RQ-17 Knowness backend update
+- Requirement: knowness refreshed on correctness writes.
+- Type: MUST.
+- Defined in: I.8, II.7.
+
+## RQ-18 Knowness formula policy
+- Requirement: lightweight formula semantics with recent-history emphasis.
+- Type: SHOULD.
+- Defined in: I.8.1.
+
+## RQ-19 Dependency gating
+- Requirement: optional gating in revisions with stack persistence rule.
+- Type: MUST.
+- Defined in: I.9.1.
+
+## RQ-20 Dependency propagation rule
+- Requirement: parent += childKnowness * impact.
+- Type: MUST.
+- Defined in: I.9.2, II.11.
+
+## RQ-21 Parent knowness drop behavior
+- Requirement: parent loses propagated contribution when child knowness drops.
+- Type: MUST.
+- Defined in: I.9.2, II.11.
+
+## RQ-22 Collection rule engine
+- Requirement: collection has explicit selection rule.
+- Type: MUST.
+- Defined in: I.10.
+
+## RQ-23 Role-based sharing
+- Requirement: private, role-shared, scoped publication.
+- Type: MUST.
+- Defined in: I.4, II.16.
+
+## RQ-24 Canonical runtime model
+- Requirement: run/participant/exposure/attempt/event normalized structure.
+- Type: MUST.
+- Defined in: II.3.
+
+## RQ-25 Explainable selection
+- Requirement: selection should expose reason traces.
+- Type: SHOULD.
+- Defined in: II.6.
+
+## RQ-26 Statistics coverage
+- Requirement: totals, distributions, timing, participant summaries, timeline.
+- Type: MUST.
+- Defined in: II.9.
+
+## RQ-27 Storyboard first-class module
+- Requirement: integrated in authoring and user-facing surfaces.
+- Type: MUST.
+- Defined in: I.15, III.8.
+
+## RQ-28 Writing first-class module
+- Requirement: integrated in authoring and user-facing surfaces.
+- Type: MUST.
+- Defined in: I.15, III.8.
+
+## RQ-29 Device compatibility
+- Requirement: desktop + phone support with functional parity.
+- Type: MUST.
+- Defined in: III.11.
+
+## RQ-30 Standalone readiness
+- Requirement: final architecture ready for standalone domain while embeddable now.
+- Type: MUST.
+- Defined in: I.1.
+
+---
+
+## Appendix A — Compact URL exemplars
+
+### A.1 Root
+- `/cogita`
+- `/cogita/home`
+
+### A.2 Workspace
+- `/cogita/workspace`
+- `/cogita/workspace/libraries`
+- `/cogita/workspace/libraries/{libraryId}`
+- `/cogita/workspace/libraries/{libraryId}/knowledge-items`
+- `/cogita/workspace/libraries/{libraryId}/cards`
+- `/cogita/workspace/libraries/{libraryId}/dependencies`
+- `/cogita/workspace/libraries/{libraryId}/collections`
+- `/cogita/workspace/libraries/{libraryId}/revisions`
+
+### A.3 Revision runtime
+- `/cogita/revision/solo/{revisionId}`
+- `/cogita/revision/shared/{shareCode}`
+- `/cogita/revision/group-async/{revisionId}`
+- `/cogita/revision/group-sync/{revisionId}`
+
+### A.4 Live
+- `/cogita/live/join/{code}`
+- `/cogita/live/wall/participant/{sessionId}`
+- `/cogita/live/wall/host/{sessionId}`
+- `/cogita/live/wall/output/{sessionId}`
+
+---
+
+## Appendix B — Display matrix
+
+| Area | Primary model | Secondary mode |
+|---|---|---|
+| Public home | A Public portal | - |
+| Logged home | B Logged dashboard | - |
+| Workspace pages | C Workspace | overlay-capable components |
+| Solo/shared/group runs | D Revision fullscreen | mobile compact fullscreen |
+| Live participant | E Live participant | mobile fullscreen |
+| Live host | E Live host | desktop multipanel |
+| Live output | E Safe output | external display |
+| Storyboard playback | immersive | mobile immersive |
+| Writing editor | focused writing | mobile compact writing |
+
+---
+
+## Appendix C — Final statement
+
+After recreation, Cogita is a coherent product where:
+1. users start in a configurable operational home,
+2. deep structure is managed in workspace mode,
+3. revision execution is canonical and fullscreen-focused,
+4. shared flow includes short token recovery,
+5. dependency propagation follows `childKnowness * impact` additive rule,
+6. storyboard and writing are integrated first-class modules,
+7. all major surfaces work across desktop and phone.
