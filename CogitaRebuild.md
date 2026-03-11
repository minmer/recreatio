diff --git a/docs/cogita-rebuild-assessment.md b/docs/cogita-rebuild-assessment.md
new file mode 100644
index 0000000000000000000000000000000000000000..4efde0b9fb6ae7dd1ead92e1fb51fdcf7aac3212
--- /dev/null
+++ b/docs/cogita-rebuild-assessment.md
@@ -0,0 +1,361 @@
+# Cogita Detailed Functional Inventory and Rewiring Plan
+
+This document is written to prevent feature loss during the rebuild.
+For every major area it describes:
+1. **how it works today**,
+2. **how it cooperates with other features today**,
+3. **what must stay unchanged in product behavior**,
+4. **what must be repaired in the new wiring**.
+
+Core assessment:
+- **UI/UX direction is mostly correct and should be preserved**.
+- **Frontend background wiring is fragmented and must be rebuilt into one canonical runtime architecture**.
+
+---
+
+## 1) Workspace and shell layer
+
+## Implemented functionality (today)
+- Cogita shell and workspace routing are available.
+- Library-level navigation exists (knowledge, collections, revisions, live, creation areas).
+- Header/footer affordances exist, including return path to Recreatio.
+- Auth and role-aware access are integrated.
+
+## Cooperation with other features
+- Shell routes users into every domain (knowledge/revision/creation/live).
+- Role context from auth/membership controls which libraries are visible and editable.
+- Workspace pages are the entry point for revision run pages and live session pages.
+
+## Must stay
+- Existing user mental model of workspace navigation.
+- Always-available return path to Recreatio.
+- Role-aware library access behavior.
+
+## Must be repaired
+- Route-level state and runtime state are currently too tightly coupled in feature pages.
+- Introduce canonical app-level runtime stores (run state, reveal state, stats state) that are reused by all run views.
+
+---
+
+## 2) Knowledge management layer
+
+## Implemented functionality (today)
+- Knowledge/info entities with multiple types are present.
+- Collections and graph/dependency-related structures are available.
+- Link structures and search/index structures exist.
+- Knowledge item editing/listing/retrieval workflows exist.
+
+## Cooperation with other features
+- Knowledge is the source material for checkcards and revision content.
+- Dependencies influence revision eligibility logic.
+- Creation projects rely on knowledge references as source material.
+
+## Must stay
+- Typed knowledge model approach.
+- Linkability between knowledge items.
+- Search/index capability for scalable retrieval.
+
+## Must be repaired
+- Consolidate old and new knowledge-related models into canonical entities:
+  - `KnowledgeTypeSpec`,
+  - `KnowledgeItem`,
+  - `KnowledgeLink`,
+  - `DependencyEdge`.
+- Remove duplicated/legacy representation paths that create inconsistent read/write behavior.
+
+---
+
+## 3) Revision runtime layer (standard, shared, live)
+
+## Implemented functionality (today)
+- Standard revision run page works.
+- Shared revision run page works.
+- Live pages exist for host/public/participant scenarios.
+- Prompt → answer → reveal loops exist.
+- Statistics and knowness-oriented UI elements are visible.
+
+## Cooperation with other features
+- Uses knowledge items/checkcards as content source.
+- Uses run/attempt/exposure persistence for tracking progress.
+- Uses shared/public/live endpoints for multi-user access modes.
+- Feeds outcome data into knowness and statistics views.
+
+## Must stay
+- Current UX paradigm: card prompting, reveal flow, progression feel.
+- Availability of solo-like runs + shared links + group/live modes.
+- Host visibility concept in grouped modes.
+
+## Must be repaired
+- Replace separate mode-specific orchestration with one runtime engine:
+  - one selector,
+  - one run lifecycle,
+  - one reveal payload contract,
+  - one stats/knowness integration layer.
+- Keep the current screens, but rewire their data/control flow to shared services.
+
+---
+
+## 4) Shared mode behavior
+
+## Implemented functionality (today)
+- Public/shared revision links can be created and used.
+- Shared users can answer revision content without full account flow.
+
+## Cooperation with other features
+- Shared mode reuses revision content and checkcards from library/revision definitions.
+- Shared mode currently intersects with public endpoints and share metadata.
+
+## Must stay
+- Lightweight join/use flow.
+- Host/admin ability to enable/disable shared access.
+
+## Must be repaired (fixed policy)
+- Shared mode remains fully ephemeral:
+  - no relogin,
+  - refresh restarts from beginning,
+  - no recovery workflow.
+- Align backend/frontend behavior so this is explicit and deterministic.
+
+---
+
+## 5) Group/live revision behavior
+
+## Implemented functionality (today)
+- Live sessions support host controls and participant/public states.
+- Scoreboard-like and round-based interactions exist.
+- Host can observe participants in session context.
+
+## Cooperation with other features
+- Uses revision/checkcard content and run persistence.
+- Produces timing/outcome data consumed by statistics.
+
+## Must stay
+- Host-controlled group teaching/testing model.
+- Participant answer visibility for host role.
+- Public/live display behavior.
+
+## Must be repaired (fixed policy)
+- `group_sync` knowness aggregation must be equal-weight average across participants.
+- Use the same canonical run event model as solo/shared (no separate scoring truth path).
+
+---
+
+## 6) Run persistence, outcomes, and statistics
+
+## Implemented functionality (today)
+- Run-related entities exist:
+  - `RevisionRun`,
+  - `RunParticipant`,
+  - `RunAttempt`,
+  - `RunExposure`,
+  - `KnownessSnapshot`,
+  - related event/stat tables.
+- Core endpoints allow reading attempts/exposures and next-card operations.
+- Client-side outcome staging exists (IndexedDB/localStorage) with sync behavior.
+
+## Cooperation with other features
+- Runtime pages read/write attempts and exposure timeline.
+- Statistics panels derive values from persisted interaction history.
+- Knowness computations depend on persisted outcome history.
+
+## Must stay
+- Exact answer timing capture.
+- Separation between exposure and attempt concepts.
+- Persistence robustness (client staging + backend persistence when needed).
+
+## Must be repaired
+- Canonicalize one statistics truth model: `RunAttempt + RunExposure + RunEvent`.
+- Remove duplicated scoring derivations across pages/services.
+- Ensure host/participant/public views all read from same normalized event semantics with visibility filters.
+
+---
+
+## 7) Knowness and dependency logic
+
+## Implemented functionality (today)
+- Knowness computation exists.
+- Dependency structures exist.
+- Runtime has some dependency-aware behavior in places.
+
+## Cooperation with other features
+- Knowness informs card selection priorities.
+- Dependencies should gate child card selection when enabled.
+- Statistics and knowness are expected to agree from same evidence.
+
+## Must stay
+- Knowness as core control signal for revision quality.
+- Dependency-aware revision behavior as configurable option.
+
+## Must be repaired (fixed policy)
+- Knowness answer classes:
+  - `correct`,
+  - `wrong`,
+  - `blank_timeout` (penalty slightly less than wrong).
+- Child knowness contributes additively to parent knowness (bounded output).
+- Dependency thresholds (e.g., 70%) must be applied by selector when dependency mode is enabled.
+- Recalculation strategy:
+  - snapshot-based,
+  - incremental updates after new events,
+  - lightweight decay projection from snapshot timestamp.
+
+---
+
+## 8) Checkcard model and reveal behavior
+
+## Implemented functionality (today)
+- Checkcard rendering and reveal UI exist in multiple contexts.
+- Different card/question types are supported.
+
+## Cooperation with other features
+- Checkcard prompt/reveal is central handoff point between:
+  - selector,
+  - scoring/knowness,
+  - statistics,
+  - user feedback.
+
+## Must stay
+- Current user-facing card interaction quality.
+- Multi-card-type capability.
+
+## Must be repaired
+- Create one shared reveal model used in solo/shared/group async/group sync.
+- Reveal payload must always include:
+  - correct answer,
+  - participant answer,
+  - past-answer summary,
+  - wrong vs blank distribution,
+  - score factor breakdown (non-zero factors only).
+
+---
+
+## 9) Creation projects (storyboards/text/tests/projects)
+
+## Implemented functionality (today)
+- Creation project structures are available.
+- Creation appears as dedicated area in workspace model.
+
+## Cooperation with other features
+- Creation consumes knowledge references.
+- Creation outputs should remain traceable back to source knowledge.
+
+## Must stay
+- Creation as first-class product pillar (not an add-on).
+- Knowledge-driven authoring concept.
+
+## Must be repaired
+- Integrate creation with canonical knowledge index and link model.
+- Add reusable pipelines for generating artifacts from knowledge selections.
+- Keep traceability metadata so products remain anchored in verified knowledge.
+
+---
+
+## 10) Cryptographic and indexing behavior
+
+## Implemented functionality (today)
+- Crypto infrastructure exists in backend and role/key model.
+- Hashing/encryption patterns are already used in parts of system.
+
+## Cooperation with other features
+- Shared/public/live flows depend on secure access scopes.
+- Knowledge references and searchability need deterministic indexing while keeping payload protected.
+
+## Must stay
+- Strong cryptographic boundaries for protected data.
+- Practical searchable/indexable behavior.
+
+## Must be repaired (fixed policy)
+- Introduce reusable field-level crypto module for reference/search fields:
+  - encrypted value,
+  - deterministic token/hash,
+  - signature metadata (version/signer/proof fields).
+- Apply automatically for knowledge-reference field types across tables.
+- Avoid per-table ad hoc crypto implementations.
+
+---
+
+## 11) Cross-functional cooperation map (what must not be broken)
+
+## Current cooperation chain
+1. User enters workspace and chooses library context.
+2. Revision runtime loads pattern/scope and checkcard candidates from knowledge layer.
+3. Selector chooses next card using mode + knowness + dependency settings.
+4. Exposure event is recorded when card is shown.
+5. Attempt event is recorded when answer/timeout occurs.
+6. Reveal payload is generated and shown.
+7. Statistics and knowness are updated from normalized events.
+8. In grouped modes, host views participant state via same event stream with visibility rules.
+
+## Rebuild requirement
+- Keep this cooperation chain functionally identical at user level,
+- but re-implement it through one canonical runtime/event architecture.
+
+---
+
+## 12) What should stay exactly as user behavior
+
+- Users can continue learning through familiar card-based flows.
+- Shared links remain easy to use and ephemeral.
+- Group sessions remain host-driven and participant-visible.
+- Statistics remain visible and informative during/after runs.
+- Workspace remains the center for knowledge/revision/creation.
+
+---
+
+## 13) What should be repaired in the new approach (priority)
+
+1. Frontend orchestration unification (highest priority).
+2. Canonical run-event statistics model.
+3. Knowness/dependency/selection convergence.
+4. Unified reveal contract.
+5. Schema and endpoint hard cleanup (no compatibility mode).
+6. Creation-core deep integration.
+7. Reusable cryptographic field framework.
+
+---
+
+## 14) Canonical naming to enforce
+
+### Entities
+- `KnowledgeTypeSpec`
+- `KnowledgeItem`
+- `KnowledgeLink`
+- `DependencyEdge`
+- `CheckcardDefinition`
+- `RevisionPattern`
+- `RevisionRun`
+- `RunParticipant`
+- `RunExposure`
+- `RunAttempt`
+- `RunEvent`
+- `KnownessSnapshot`
+- `CreationProject`
+- `CreationArtifact`
+
+### Modes
+- `solo`
+- `shared`
+- `group_async`
+- `group_sync`
+
+### Statuses
+- `draft`
+- `lobby`
+- `active`
+- `paused`
+- `finished`
+- `archived`
+
+---
+
+## 15) Further functionality (post-convergence roadmap)
+
+- Long-horizon knowness development charts and analytics.
+- Advanced host dashboards (teacher-grade oversight + export).
+- Dependency simulation and impact preview tools.
+- Reusable revision pattern marketplace/templates.
+- Selector/knowness explainability traces for debugging and trust.
+- Scale hardening for very large libraries and many concurrent runs.
+- Stronger cryptographic auditing and forensic tooling.
+
+These are phase-after-convergence improvements and should not delay canonical rewiring.
+
