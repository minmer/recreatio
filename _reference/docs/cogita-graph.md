# Cogita Graph — Architecture Specification

## Document metadata

- Status: Design target. Subject to review before implementation begins.
- Scope: New Cogita implementation at `/#/cg/...`. Old `/#/cogita/...` routes remain untouched during transition.
- Relation to prior spec: Supersedes the structural hierarchy in `CogitaAim.md`. The knowness formula, revision runtime model, and live session contracts from that document remain valid and are referenced here where relevant.
- Language: English.

---

## 0. What this document describes

This document defines the architecture for a new version of Cogita — a living knowledge graph platform. The new version is built around one insight: **all knowledge is a graph**. Vocabulary lists, concept maps, theological perspectives, atomic properties, historical timelines, phone books — all of them are nodes connected by edges. The same platform serves all of them by giving users full control over the schema while the system provides only the mechanics.

The new implementation lives at `/#/cg/...` and runs alongside the existing `/#/cogita/...` implementation, which remains untouched.

---

## 1. Data model

### 1.1 Graph fundamentals

The entire knowledge base is one directed graph. Two things exist in it:

1. **Nodes** — carriers of content or structure.
2. **Edges** — typed directed connections between nodes.

Nodes have a **kind**. A small set of kinds is built-in:

| Built-in kind | Description |
|---|---|
| `Text` | Plain or rich text value. |
| `Number` | Numeric value with optional unit. |
| `Date` | Calendar value with optional precision (year / month / day). |
| `Boolean` | True / false / unknown flag. |
| `Media` | File reference: image, audio, video, document. |

Built-in kinds cannot be redefined by the user. All other kinds are either user-defined (via the Schema layer, §1.2) or knowledge-layer system kinds (Knowledge node, Text node, Topic node — §2).

### 1.2 EntityKind — user-defined node types

An EntityKind is itself a node in the graph. It defines:

- A name (e.g. `Person`, `Book`, `Atom`, `Word`, `Contact`).
- An ordered list of field definitions — each field names a relationship to another node or to a primitive.
- Optionally: which other EntityKinds may appear as subentities under it.

**First-field convention:** The first field in the EntityKind definition is treated as the primary display label. The system uses it in lists, search results, and graph canvas nodes. No special flag or `label` property exists — position in the field list is the only signal. All fields are indexed for search.

The user creates EntityKinds inside the Schema editor. The system does not prescribe any EntityKind. `Person` is not built in. `Book` is not built in. The user builds their own schema to fit their domain.

**Scope:** EntityKinds are scoped to the library they are created in. They are not shared across libraries simultaneously. A schema can be exported as a template and imported into another library, creating an independent copy there — a change to the schema in library A does not affect library B.

### 1.3 Entity nodes

An entity node is a pure connection point. It has:

- A stable identity (UUID).
- An EntityKind reference (to the kind that defines it — scoped to the same library).
- Field values as defined by its EntityKind — primitives stored inline, references stored as edges to other entity nodes.

**An entity has no dedicated label field.** Display and search use the first field declared in the EntityKind definition. If no fields are filled in yet, the entity shows as its EntityKind name + UUID fragment until the first field is filled.

### 1.4 Date fields

A date field's type is the built-in `Date` primitive, stored with a PropertyValue envelope (§1.6) carrying uncertainty state, optional range, and source.

If a user wants multiple competing date values for one field (e.g. three sources giving three birth years), they declare the field as multi-value in the schema. Each value gets its own PropertyValue envelope.

### 1.5 Modeling multiple names

There is no built-in Name entity type. The user defines how names are stored in their schema.

Common patterns:

- **Simple:** `Person` has a `fullName` Text field as its first field. Search finds it by that text.
- **Multiple names:** `Person` has several Text fields: `firstName`, `lastName`, `title`, `alternativeName`. All are indexed. The first declared field is the display label.
- **Rich name modeling:** The user creates a `Name` EntityKind with fields `text`, `language`, `form` (birth / title / alias / transliteration), and an EdgeKind `hasName` from `Person` to `Name`. This is a valid schema design — but it is the user's choice, not a system requirement.

Searching "David" finds all entities whose indexed text fields contain "David". The user sees the full result list and selects — the system never auto-selects.

### 1.6 PropertyValue envelope

Every edge connecting an entity to a value carries a PropertyValue envelope:

| Field | Values / Type |
|---|---|
| `state` | `known` / `approximate` / `disputed` / `unknown` / `not-applicable` / `pending` |
| `value` | Point value (primitive). Mutually exclusive with `range`. |
| `range` | Reference to a Range node (§1.6a). Used when the value spans intervals. |
| `source` | Optional reference to a source entity. |
| `note` | Optional text note. |

### 1.6a Range node

A Range node is a system-level node holding an ordered list of segments. Each segment is a contiguous interval expressed in one primitive type — Date, Number, or Text. All segments in one Range node must share the same type.

A segment contains:

| Field | Description |
|---|---|
| `from` | Start of the interval (primitive value). |
| `to` | End of the interval (primitive value). Optional — omit for a single point. |
| `fromState` | `inclusive` / `exclusive` / `approximate` / `unknown` |
| `toState` | `inclusive` / `exclusive` / `approximate` / `open` (no known end) |

**Why multiple segments:** A king who ruled 992–1000 and again 1002–1025 has a reign expressed as two Date segments. A manuscript cited across pages 3–7 and 41–43 has two Number segments. A field declared `range-capable` in the schema presents a Range editor instead of a single value input.

### 1.7 Multi-value fields

A field can have multiple connected nodes. Each is a separate edge with its own PropertyValue envelope. Example: `Mieszko I` has three `bornOn` edges — each to a different Date value, each with `state: disputed` and a different source reference. All three are shown together; none is collapsed.

### 1.8 Subentities

A subentity is owned by a parent entity and does not exist independently. It is declared at schema level — the `Contact` EntityKind may declare `Phone` and `Email` as subentity kinds. Subentities are created, edited, and deleted through the parent entity editor.

Examples:
- `Contact` → subentities: `Phone`, `Email`, `Address`
- `Atom` → subentities: `Isotope`, `OxidationState`
- `Person` (as king) → subentity: `Reign` (start date, end date, title, kingdom)
- `Book` → subentity: `Chapter` (number, title)

### 1.9 Type unions on fields

A field definition may declare that it accepts multiple EntityKinds:

- A `citedIn` field on `Concept` may point to either `Book` or `Article`.
- A `ruler` field on `Reign` may point to either `Person` or `Dynasty`.

When the user fills in the field, the search overlay shows candidates of any declared kind.

### 1.10 EdgeKind — user-defined relationship types

An EdgeKind is itself a node in the graph. It defines:

- A name (e.g. `bornIn`, `writtenBy`, `partOf`, `translatesTo`, `antonymOf`).
- Source EntityKind(s).
- Target EntityKind(s) — type union.
- Cardinality: one / many.
- Directionality: directed / bidirectional.

Built-in EdgeKinds (structural mechanics, not user-visible as schema choices):

| Kind | Meaning |
|---|---|
| `ownerOf` | Subentity → parent entity (enforced by system). |
| `dependsOn` | Node → Node (KnowScore gating; declared by user in schema). |

---

## 2. Knowledge layer

The knowledge layer is built from three node types: **Knowledge node**, **Text node**, and **Topic node**. Together they replace the old Q&A and Lens constructs with a more generic and composable model.

### 2.1 Knowledge node

A Knowledge node is the atomic unit of knowledge — the smallest statement that stands on its own.

| Field | Type | Description |
|---|---|---|
| `statement` | Text | The knowledge content: a fact, claim, definition, or observation. |
| `entityLinks` | Entity[] | Entities this statement is about. Linked during authoring via the search overlay. |
| `source` | Entity ref | Optional source entity. |

A Knowledge node generates Cards for revision. Each Card is derived from one Knowledge node; the question side is supplied by the Topic node that contains this Knowledge node as an answer.

Knowledge nodes are the building blocks that both Topic nodes and Text nodes compose from.

### 2.2 Text node

A Text node is a composed, ordered sequence of Knowledge nodes with a narrative frame around them. It is the authoring unit for explanations, essays, and storyboard-like content.

| Field | Type | Description |
|---|---|---|
| `title` | Text | Title of the text. |
| `intro` | Text | Optional opening paragraph (narrative context). |
| `body` | Knowledge[] | Ordered list of Knowledge nodes — the content. |
| `conclusion` | Text | Optional closing paragraph. |

A Text node can appear as the answer to a Topic node. In the session runner, a Text node is rendered as a readable narrative (Storyboard mode) or as a sequence of flashable Knowledge nodes (Revision mode).

A Text node is the structured equivalent of what was previously called a Storyboard node. It is authored, not auto-generated.

### 2.3 Topic node

A Topic node is the organizational layer. It can be a **question** (something to be answered), a **topic heading** (something to be explored), or a **curriculum node** (something that organizes other topics into a learning path). These roles are not mutually exclusive — a Topic can be all three at once.

| Field | Type | Description |
|---|---|---|
| `text` | Text | The question or topic heading. |
| `answers` | (Knowledge \| Text)[] | One or more answers — Knowledge nodes, Text nodes, or a mix. |
| `childTopics` | Topic[] | Sub-topics that this Topic opens. Builds the curriculum graph. |
| `entityAttachment` | EntitySet? | Optional. See §2.4. |

Perspective, depth, and status are not fields on the Topic node itself. They are stored in the node annotation table described in §2.8.

A Topic node with `answers` containing Knowledge nodes is effectively a Q&A pair: the topic text is the question, the Knowledge nodes are the answer statements.

A Topic node with `answers` containing Text nodes is a guided reading unit: the topic text is the entry heading, the Text nodes are the explanations.

A Topic node with `childTopics` is a curriculum organizer: "Books of the Old Testament" → child topics: "Books of Samuel", "Books of Kings", etc.

### 2.4 Parallel Topic bundle

A Topic node may have an `entityAttachment` — a reference to the entity this particular topic is about. When multiple Topic nodes share the same parent Topic and each is attached to a different entity of the same kind, the parent Topic shows that these are **parallel questions**: the same question asked about a series of entities.

The system does not auto-generate these child topics. The user creates each one manually. The parent Topic reveals the parallelity by grouping them.

`entityAttachment` on a child Topic contains:

| Field | Description |
|---|---|
| `entity` | The specific entity this topic instance is about. |

**Example:** The parent Topic text is "How is David shown in 1 Samuel?" The user manually creates child Topics, each with an `entityAttachment` pointing to a different Chapter entity:

- Child Topic: "How is David shown in Chapter 16?" → Knowledge node: "David is introduced as a shepherd chosen by God."
- Child Topic: "How is David shown in Chapter 17?" → Knowledge node: "David defeats Goliath."
- Child Topic: "How is David shown in Chapter 19?" → Knowledge node: "David flees from Saul."

The parent Topic "How is David shown in 1 Samuel?" groups these and makes the parallelity visible — in the session runner they can be navigated as a sequence or compared across instances. The user decides how many child Topics to create and when each one is complete.

### 2.5 Topic hierarchy and curriculum graph

Topics can be nested to any depth. The structure that emerges is a curriculum graph:

```
Topic: "Books of the Old Testament"  [foundational]
  └── Topic: "Books of Samuel"
        ├── Knowledge: "The Books of Samuel are two books of the Old Testament."
        ├── Topic: "Who wrote the Books of Samuel?"
        │     └── Knowledge: "Authorship is traditionally attributed to Samuel, Nathan, and Gad."
        └── Topic: "How is David shown in 1 Samuel?"  ← parallel bundle
              ├── Topic: "...in Chapter 16?" [entity: Chapter 16] → Knowledge: "David is introduced as a shepherd."
              ├── Topic: "...in Chapter 17?" [entity: Chapter 17] → Knowledge: "David defeats Goliath."
              └── (user adds more as they author them)
```

The hierarchy is both a curriculum (what to learn and in what order) and an organization (how knowledge is grouped). A student at foundational depth sees the top levels; an advanced student can descend to any depth.

### 2.6 Authoring flow

The teacher starts with a Topic node — a question or heading:

1. **Write the topic text.** "What are the Books of Samuel?"
2. **Add Knowledge nodes as answers.** "The Books of Samuel are books of the Old Testament." — typed directly in the Topic editor as a new Knowledge node.
3. **Link entities in the Knowledge node.** Select "Books of Samuel" and "Old Testament" in the statement text → search overlay opens → teacher picks the matching entity for each.
4. **For each linked entity, decide:**
   - **Expand now** — a child Topic node is created immediately for that entity. The teacher writes it next.
   - **Expand later** — the entity is linked but the child Topic is left open (`status: open`).
   - **No expansion** — the entity is linked but generates no child Topic.
5. **Optionally write a Text node.** If the answer is narrative rather than a single statement, the teacher creates a Text node instead of (or alongside) Knowledge nodes.

This flow builds the curriculum graph naturally through writing. The teacher stays in a text-first rhythm; the graph structure emerges from authoring decisions.

### 2.7 Vocabulary as a special entity

Vocabulary is not a separate construct. A vocabulary entry is a regular entity whose EntityKind has the structure of two Text fields connected to each other — one for each side of the pair.

Example schema:
- EntityKind: `WordPair`
- Fields: `sourceWord` (Text, first — used as label), `targetWord` (Text)

The user creates one `WordPair` entity per vocabulary item. Cards are generated from this entity just like any other entity: one Card tests `sourceWord → targetWord`, another tests `targetWord → sourceWord`. The revision system handles both directions from a single entity.

Additional fields can be added to the same EntityKind as needed — `context`, `exampleSentence`, `notes` — without any special vocabulary machinery. The schema is the user's to design.

### 2.8 Open-topic tracking table

The only thing stored in this table is whether a Topic node is open — meaning the teacher has decided to expand this topic further but has not yet written the content.

| Column | Type | Description |
|---|---|---|
| `topicId` | UUID | ID of the Topic node marked as open. |
| `markedByUserId` | UUID | The user who marked it open. |
| `note` | Text | Optional note on what is expected here. |

A Topic is marked open during the authoring flow when the teacher selects "Expand later" for a linked entity — the child Topic node is created and immediately entered into this table. It remains there until the teacher writes its content and removes the open mark.

The Pending list in the Dashboard queries this table to show the teacher what remains to be written. No other metadata (perspective, depth) is stored here — those are not tracked by the system at all.

---

## 3. Session layer

The session layer is an engine that reads the graph and presents it to the user. The graph owns all content — entities, Knowledge nodes, Text nodes, Topic nodes, Question nodes, Characters. The session does not own any of it. What the session owns is the traversal state, the current values, and the statistics computed from the run.

### 3.1 Question nodes

Topic nodes organize knowledge — they are a curriculum structure, not a revision mechanism. **Question nodes are a separate node type** placed explicitly in the graph by the teacher to create a check at a specific point.

| Field | Type | Description |
|---|---|---|
| `text` | Text | The question presented to the user. |
| `answerType` | Enum | `text-input` / `multiple-choice` / `true-false` / `match` |
| `answers` | Text[] | Correct answers or answer criteria. |
| `entityLinks` | Entity[] | Entities or Knowledge nodes this question is testing. |
| `onCorrect` | Node ref | Next node to follow if answered correctly (optional). |
| `onWrong` | Node ref | Next node to follow if answered incorrectly (optional). |

Question nodes are encountered during graph traversal. When the session runner reaches a Question node, it enters check mode: presents the question, captures the answer, updates KnowScore, then follows the appropriate edge.

KnowScore (the temporal knowness algorithm from `CogitaAim.md §I.8`) is keyed to Question node IDs. The `dependsOn` EdgeKind gates traversal: a Question node is not offered until its prerequisite's KnowScore crosses a threshold. Propagation rule: `parentKnowness += childKnowness * impact`.

### 3.2 Values

Values are quantities that belong to a participant or a group, change during a session, and persist between sessions. They are not stored on nodes — they live in a separate value table referencing the session, the context node or entity, and the participant.

**User values** — individual to each participant:
- KnowScore per Question node (the temporal knowness algorithm)
- Accumulated score from correct answers in this session
- Choices made at decision points (which branch was taken)
- Custom values declared by the creator in the library schema (e.g. character relationship level, alignment, inventory)

**Group values** — shared across all participants in a session:
- Collective score
- Shared narrative state (which branch the group is on)
- Group-level decisions made by vote or by the host

The creator defines custom value types as part of the library. These are referenced by Character Dialogue triggers and by conditional edges in the graph — so values drive which character dialogue fires, which path is taken, and what content is shown. The result is a personalized output that differs per user or group based on their accumulated values and decisions.

### 3.3 Traversal modes

| Mode | Path determination |
|---|---|
| **Free** | User navigates any node at will. No imposed direction. No scoring unless a Question node is encountered. |
| **Directed** | Follows a path through the graph defined by the creator using specific edge types (quest edges). Character dialogues fire based on value triggers. Question nodes act as checkpoints. |
| **Algorithmic** | Question nodes are selected by the KnowScore algorithm and revision strategy, independent of graph path order. |

Mode switching is allowed mid-session without losing position in the graph.

### 3.4 What the session uses from the graph

The session runner reads different node types and treats them differently:

| Node type | Session role |
|---|---|
| Entity node | Displayed as a structured data card. Fields shown per EntityKind schema. |
| Knowledge node | Displayed as a statement. Used for reading in free and directed modes. |
| Text node | Displayed as a narrative sequence of Knowledge nodes. |
| Topic node | Used as navigation structure — shows what child topics or knowledge exists. Not presented as a question. |
| Question node | Triggers check mode: present question, capture answer, update KnowScore, follow conditional edge. |
| Character entity | Its Dialogue subentities are evaluated; the matching dialogue fires based on current values. |

### 3.5 Statistics

Statistics are computed from the traversal record — what nodes were visited, which Question nodes were answered and with what result, how values changed, how long each step took.

Available in real time during the session:
- Per-participant answer history and current values.
- Group aggregate: distribution of answers, collective value state.
- Host view: full statistics with per-participant breakdown.

Available after the session in the Dashboard:
- Question-level correctness per participant.
- Value trajectory across the session.
- Path summary: which nodes were visited, which were skipped.
- KnowScore changes from this session.

### 3.6 Group and live layer

The group layer adds multiple participants to any traversal mode. A join code is generated; participants join. The session then maintains both individual values (per participant) and group values (shared state).

In directed and algorithmic modes, question delivery can be synchronized — all participants answer the same Question node simultaneously. The host sees aggregate answer distribution in real time.

Additional group-layer features:
- Host controls pace (next / pause / reveal).
- Safe output screen: participant-facing display suitable for projection, without host-only data.
- Per-participant and aggregate statistics available to host in real time.

The backend contracts from `CogitaAim.md §II.18` apply to the live synchronization mechanics.

---

## 4. UI hierarchy and routes

### 4.1 Routes

Old routes (`/#/cogita/...`) are preserved unchanged. The new implementation lives at:

```
/#/cg
/#/cg/:libId
/#/cg/:libId/graph
/#/cg/:libId/graph/canvas
/#/cg/:libId/graph/outline
/#/cg/:libId/graph/table
/#/cg/:libId/studio
/#/cg/:libId/studio/schema/types
/#/cg/:libId/studio/schema/edges
/#/cg/:libId/studio/entities
/#/cg/:libId/studio/knowledge/topics
/#/cg/:libId/studio/knowledge/questions
/#/cg/:libId/studio/quests
/#/cg/:libId/studio/quests/:questId/characters
/#/cg/:libId/session
/#/cg/:libId/session/:sessionId
/#/cg/:libId/dashboard
```

### 4.2 Full page hierarchy

```
Cogita Graph (/#/cg)
│
├── Home
│   ├── [First visit] Role selection → guided onboarding → first action
│   └── [Returning]  Dashboard: last position + pending items + quick actions
│
└── Library (/#/cg/:libId)
    │
    ├── Overview
    │   └── Template summary (adapts to user role and library type)
    │
    ├── Graph
    │   ├── Canvas view   — visual graph, drag/zoom, click to open node
    │   ├── Outline view  — hierarchical tree of entities by EntityKind
    │   └── Table view    — tabular entity list with inline column filter
    │       (No separate "Collections" page — filtering is inline in Table view.)
    │
    ├── Studio            — teacher / creator build tools
    │   ├── Schema
    │   │   ├── Types     — EntityKind editor + subentity definitions + field declarations
    │   │   └── Edges     — EdgeKind editor + source/target type unions + cardinality
    │   ├── Entities      — entity editor; adapts to schema; handles subentities inline
    │   ├── Knowledge
    │   │   ├── Topics    — topic editor: write topic → add Knowledge nodes → link entities
    │   │   │              (parallel bundles created here by attaching entities to child topics)
    │   │   ├── Questions — question node editor: text, answer type, correct answers, conditional edges
    │   └── Quests
    │       ├── Characters — Character entity + Dialogue subentities
    │       └── Quests     — traversal path editor
    │
    ├── Session           — unified runner (all three modes)
    │   ├── Topic view    — exploration: topic text + knowledge nodes + child topics
    │   ├── Challenge view — revision: topic as question → knowledge node reveal → score
    │   ├── Storyboard view — text node narrative + checkpoint gates
    │   └── Live overlay  — multiplayer layer over any mode
    │
    └── Dashboard
        ├── Pending list  — open topics + entities without knowledge + flagged nodes
        ├── Knowledge map — KnowScore heatmap across entity graph
        └── Progress      — KnowScore distributions: known / learning / unseen
```

### 4.3 Graph views

**Canvas view** is a visual graph. Nodes appear as cards; edges as labelled arrows. The user can:
- Click a node to open it (entity detail panel slides in from side).
- Double-click to enter the node and see its full detail.
- Drag to pan; scroll to zoom.
- Use the search overlay (Cmd+K) to jump to a node.
- Filter by EntityKind to reduce visual clutter.

**Outline view** is a hierarchical tree grouped by EntityKind. Subentities are nested under their parents.

**Table view** is a flat list of entities of one EntityKind, with column filters built from the schema fields. Filtering is inline — no separate Collections page.

### 4.4 Studio

Studio is the creator's build environment. Students can view Studio but cannot edit.

The Schema editor is the entry point for new libraries. The creator defines EntityKinds, their fields, and subentity structure before adding entities.

The Entity editor adapts to the active schema. Subentity panels appear inline (a Contact editor contains an inline Phone and Email list).

The Topic editor is writing-first. The creator types the topic text, then adds Knowledge nodes inline — each is a statement typed directly in the editor. Entity linking opens the search overlay. Child topics are created from the "Expand" decision on each linked entity.

### 4.5 Session runner

```typescript
type SessionConfig = {
  libraryId: string;
  mode: 'free' | 'directed' | 'algorithmic';
  scope: NodeScope;       // 'all' | questionNode[] | entity[] | startNode
  revisionStrategy?: RevisionStrategy; // if mode === 'algorithmic'
  groupEnabled: boolean;
};
```

The runner maintains traversal state, values (user and group), and statistics. It switches between modes without losing graph position. Revision strategy types for algorithmic mode follow `CogitaAim.md §I.11`: random fixed, full random, level-based, time-knowness.

### 4.6 Dashboard

- **Pending list**: Open topics (from §2.8 open-topic tracking table), entities with no linked Knowledge or Question nodes, nodes flagged because a linked entity changed.
- **Knowledge map**: Entity graph as KnowScore heatmap over Question nodes. Red (unseen) → yellow (learning) → green (known). Clicking starts an algorithmic session targeting that cluster.
- **Progress**: KnowScore distributions — known / learning / unseen — with a bar chart.
- **Session statistics**: Summary of recent sessions — values reached, questions answered, path taken.

---

## 5. Search overlay

Search is a global keyboard-first overlay triggered by Cmd+K (Ctrl+K on Windows), or programmatically when entity linking begins.

### 5.1 Behavior

1. Overlay appears centered, covering the current page with a translucent backdrop.
2. Focus moves immediately to the search input.
3. The user types; results update in real time.
4. Arrow keys navigate the result list.
5. Enter selects the highlighted result.
6. Escape closes the overlay and returns focus to the triggering element.

### 5.2 Result types

| Context | Results returned |
|---|---|
| Global navigation (Cmd+K) | Libraries, entities, Topics, Text nodes, pages. |
| Entity linking in Topic / Knowledge editor | Entities only. All indexed fields searched. |
| Field fill in entity editor | Entities of the declared field kinds only. |
| Structural query (outline view filter) | EntityKind list only. |

Results are ranked: exact match on the first (label) field first, then fuzzy match across all indexed text fields, then Topic and Knowledge node text.

### 5.3 "Multiple Davids" handling

When "David" matches multiple entities, the overlay shows all matches. Each result shows:
- Value of the first (label) field.
- EntityKind badge.
- One distinguishing property from another field (e.g. "period: 10th century BCE").

The user selects one. The system never auto-selects.

---

## 6. Context aliases

Context aliases solve word-sense disambiguation in linked content.

When a creator links a term in a Knowledge node statement to an entity, a secondary panel appears:

> "In this context, which of these names are interchangeable with 'Books of Samuel'?"

The creator can add aliases: "Samuel Books", "1–2 Samuel", "ספר שמואל". These aliases are stored on the link edge — they apply only within this Knowledge node, not globally.

This allows:
- Theological contexts: "Holy Scripture" and "Bible" alias to the same entity in one Knowledge node; different aliasing in another.
- Historical contexts: "Mieszko", "Mieszko I", "Dagome" alias to the same Person entity.
- Mathematical contexts: "∇·F", "div F", "divergence of F" alias to the same concept entity.

---

## 7. User types and templates

On first visit, the user selects a role. This shapes which features are surfaced and in what order. The user can change role at any time.

### 7.1 Teacher

**Profile:** Creates content for others. Designs schema. Writes Topics and Knowledge nodes. Builds Quests.

**First action:** "Create a library" → Schema editor.

**Default view:** Studio.

**Features surfaced first:** Schema, Topic editor, Quest editor, Pending list.

**Features deferred:** Session runner (they test it; students use it).

### 7.2 Student

**Profile:** Consumes content created by a teacher. Revises. Follows Quests.

**First action:** "Pick a library" → Library overview → "Start revision" or "Begin Quest".

**Default view:** Session runner.

**Features surfaced first:** Session runner (all modes), KnowScore progress, Dashboard.

**Features hidden:** Studio (schema, entity editor, Topic editor, Quests).

### 7.3 Self-learner

**Profile:** Builds their own library and practices from it. Teacher + Student in one.

**First action:** "Create a library" → "Add your first item" (entity editor or Topic editor).

**Default view:** Graph view (to see what's been built) alongside Dashboard (to practice).

**Features surfaced:** Everything except advanced Studio tools. Schema editor is accessible but scaffolded.

### 7.4 Researcher

**Profile:** Explores and annotates a graph. Graph-first; knowledge authoring is secondary.

**First action:** "Open a library" → Canvas view.

**Default view:** Graph canvas. Entity editor prominent. Topic editor secondary.

**Features surfaced first:** Graph canvas, entity editor, edge editor, Exploration mode session.

**Features deferred:** Revision mode. Live overlay. Quests.

### 7.5 Casual

**Profile:** Minimal schema, practical use. Phone book, personal notes, shopping list.

**First action:** "Quick add" — a simplified entity creation form.

**Default view:** Table view.

**Features hidden:** Topic editor, Session runner, KnowScore, Studio (unless explicitly opened). The platform behaves as a structured personal database.

---

## 8. First visit and returning visit experience

### 8.1 First visit

1. **Gate.** `/#/cg` and all its sub-routes require authentication. A visitor who is not logged in is redirected to the standard presentation slides of the platform. The Cogita graph interface is never shown to unauthenticated users.
2. **Sign-in.** After signing in, the user lands at `/#/cg` for the first time.
3. **Role selection.** The user picks from five role cards (Teacher, Student, Self-learner, Researcher, Casual), each with a one-sentence description. A "Skip" link goes to a generic dashboard.
4. **Onboarding action.**
   - Teacher: "Create your first library" → Schema editor.
   - Student: "Browse shared libraries" → Library list filtered to shared libraries.
   - Self-learner: "Create your first library" → Quick create form.
   - Researcher: "Open a library" → Library list.
   - Casual: "Quick add your first item" → Minimal entity form.
5. **Guided first step.** A single guided overlay — not a forced multi-step wizard. The user can dismiss at any point.

### 8.2 Returning visit

1. **Instant resume.** Last position stored (library + view + node). "Continue where you left off" card is first visible element.
2. **Pending count.** Badge shows open Topics and unlinked entities across all libraries.
3. **Dashboard.** Knowledge map and progress for the most recently active library.
4. **Quick actions.** Three buttons: "Revise", "Explore", "Edit" — each drops directly into the last active library in the corresponding mode.

---

## 9. Session persistence

### 9.1 Stored on server

- All graph data: entities, edges, Knowledge nodes, Text nodes, Topic nodes, Quests, Characters.
- KnowScore snapshots (computed on backend after each correctness event).
- Library membership and access roles.
- User role preference.
- Dashboard configuration.

### 9.2 Stored locally (IndexedDB)

- Last position: `{ libraryId, view, nodeId, mode }`.
- KnowScore read cache: refreshed on session start and after each correctness event.
- Search overlay history: last 20 queries per library.
- Onboarding completion flag.
- Session draft state: if a revision session is in progress and the tab closes, the session state is preserved locally and resumable from Dashboard.

### 9.3 Not persisted locally

- Graph data — server-authoritative. No offline editing.
- Access control decisions.
- Topic / Knowledge node draft state — the editor autosaves to server on each tick.

---

## 10. Domain examples

### 10.1 Biblical / theology

**Schema:**
- EntityKinds: `Person`, `Place`, `Book`, `Chapter`, `Word`, `Concept`
- EdgeKinds: `appearsIn`, `locatedIn`, `mentionedIn`, `translatesTo`, `synonymOf`, `relatedTo`

**Knowledge structure:**

Topic: "What are the Books of Samuel?"
- Knowledge node: "The Books of Samuel are two books of the Old Testament." [entities linked: Books of Samuel, Old Testament]
- Child topic (expand now): "What is the Old Testament?" → Knowledge node: "The Old Testament is the first part of the Christian Bible, corresponding to the Hebrew Bible."

Parallel topic bundle: "How is David shown in 1 Samuel?"
- The user manually creates child Topics, each attached to a specific Chapter entity.
- "...in Chapter 16?" [entity: Chapter 16] → Knowledge node: "David is introduced as a shepherd chosen by God."
- "...in Chapter 17?" [entity: Chapter 17] → Knowledge node: "David defeats the Philistine giant Goliath."
- The parent Topic groups them and makes the parallelity visible. Sequential navigation and comparative questions are available in the session runner. The user decides how many chapters to author.

**Context aliases:**
- "ruach" (Word entity) — in a Knowledge node about Genesis 1: aliases "Spirit", "Wind", "Breath" added for this context. In a node about Ezekiel 37: aliases "wind" and "breath" only.

**Perspective tags:**
- Three Knowledge nodes all link to `Person:David`. One tagged `historical`, one `biblical`, one `traditional-Jewish`. All three answer the Topic "Who was David?" — not in conflict, three different perspectives on the same entity.

**Multi-name search:**
- `Book` EntityKind has fields: `canonicalName` (first — label), `alternativeNames` (multi-value Text), `originalTitle`. Searching "1–2 Samuel", "Books of Samuel", or "ספר שמואל" all find the same entity.

### 10.2 Math / physics

**Schema:**
- EntityKinds: `Element`, `Atom`, `Isotope` (subentity of Atom), `Unit`, `Formula`
- EdgeKinds: `hasProperty`, `usedIn`, `derivedFrom`

**Knowledge structure:**

Topic: "What is the atomic mass of Carbon?"
- Knowledge node: "The atomic mass of Carbon-12 is exactly 12 u by definition." [entity: Carbon-12 Isotope]
- Knowledge node: "Carbon-13 has atomic mass 13.003 u." [entity: Carbon-13 Isotope]
- Knowledge node: "Carbon-14 has atomic mass 14.003 u." [entity: Carbon-14 Isotope]

PropertyValue state:
- `Atom:Oganesson` → `atomicMass` field → PropertyValue with `state: approximate`.
- `Atom:Carbon` has three Isotope subentities; each has `atomicMass`, `stability`, `naturalAbundance`.

**Sorting:**
- Table view of `Element` entities sorted by `atomicNumber` ascending.

### 10.3 Phone book

**Schema:**
- EntityKind: `Contact` → subentities: `Phone`, `Email`, `Address`
- Fields on Contact: `firstName` (first — label), `lastName`, `organization`, `notes`
- Fields on Phone: `number`, `label` (mobile / work / home), `country`

**Usage:**
- No Topics, no Knowledge nodes, no revision sessions.
- The user role is Casual; Studio and Session runner are hidden.
- Table view shows Contacts as rows; Phones and Emails as inline chips.
- Search finds "Kowalski" via the `lastName` indexed field.

### 10.4 Language learning

**Schema:**
- EntityKind: `WordPair` — fields: `sourceWord` (Text, first — label), `targetWord` (Text), `context` (Text), `exampleSentence` (Text)
- EntityKind: `Phrase` — fields: `text` (Text), `translation` (Text), `language` (Text)

**Vocabulary usage:**
- The user creates one `WordPair` entity per vocabulary item: `sourceWord: "Haus"`, `targetWord: "house"`, `context: "as a building"`.
- Cards are generated in both directions: one asks for `targetWord` given `sourceWord`, the other the reverse.
- No special language pair machinery — it is just an entity with two connected text fields.

**Topic usage:**
Parallel topic bundle: "What is the grammatical article of German nouns?"
- The user creates one child Topic per noun, each attached to a specific `WordPair` entity.
- Each child Topic has a Knowledge node with the correct article (der/die/das).
- The parent Topic groups them and makes the parallelity visible in the session runner.

### 10.5 History

**Schema:**
- EntityKinds: `Person`, `Place`, `Event`, `Dynasty`, `Kingdom`
- SubentityKinds: `Reign` (subentity of Person), `Battle` (subentity of Event)
- EdgeKinds: `bornIn`, `diedIn`, `ruledOver`, `participatedIn`, `locatedAt`, `succeededBy`

**Knowledge structure:**

Topic: "Who were the kings of Poland?"
- Entity-parameterized child topics: one per Person entity with a Reign subentity, ordered by `reign.reignFrom`.
- Each king instance has Knowledge nodes: "Mieszko I was the first historical ruler of Poland, reigning approximately 960–992."

Date handling:
- `Mieszko I` has three `bornOn` fields (multi-value), each with `state: disputed` and a different source.
- `Reign` subentity has `reignFrom` as a Range node with two Date segments: 960–992 and a disputed break.

Text node: "Introduction to the Piast Dynasty" — an ordered sequence of Knowledge nodes about the dynasty's founding, main rulers, and end. Usable in Storyboard mode as a readable narrative.

---

## 11. Migration from old Cogita

The new `/#/cg` implementation is additive. The existing `/#/cogita` implementation is not modified.

### 11.1 Data mapping

| Old concept | New concept |
|---|---|
| Library | Library (same entity, shared backend) |
| Notion (`info`) | Entity node (with auto-inferred EntityKind `Notion`) |
| Card | Card (unchanged — generated from Knowledge nodes) |
| Collection | Inline filter in Table view (no separate entity) |
| Revision template | Session config (same revision strategy types) |
| KnowScore / correctness entry | Unchanged (same formula, same backend) |
| Dependency edge | `dependsOn` EdgeKind |
| Q&A node | Question node (the check) + Knowledge node (the knowledge content) |
| Storyboard | Text node (authored sequence of Knowledge nodes) |
| Lens | Parallel Topic bundle (user-authored child Topics grouped under a parent) |
| Language pair | `WordPair` entity (EntityKind with two Text fields) |
| Writing project | Preserved in old routes; future integration planned |

### 11.2 Old route preservation

All `/#/cogita/...` routes continue to work. No redirects.

### 11.3 Rollout strategy

Phase 1: New `/#/cg` routes exist alongside old routes. Users can switch between old and new views of the same libraries.

Phase 2: Library Overview in new routes displays a template adapted to the library's content type (matching the existing template system).

Phase 3: Once the new implementation covers all features of the old one, a migration guide is offered opt-in. Old routes are kept as permanent aliases.

---

## 12. Reusable component inventory

All major UI components must work in two contexts: as a full page and as an overlay panel.

| Component | Full page context | Overlay context |
|---|---|---|
| Entity detail | `/#/cg/:libId/studio/entities/:entityId` | Slide-in panel from graph canvas or search result |
| Entity editor | Same page, edit mode toggle | Overlay from "+ Add entity" anywhere |
| Topic editor | `/#/cg/:libId/studio/knowledge/topics/:topicId` | Overlay from pending list or entity knowledge tab |
| Knowledge node editor | Inline in Topic editor | Inline anywhere a Knowledge node is referenced |
| Text node editor | `/#/cg/:libId/studio/knowledge/topics/:topicId/text/:textId` | Overlay from topic answer list |
| Question node editor | `/#/cg/:libId/studio/knowledge/questions/:questionId` | Overlay from graph canvas or Studio |
| Value inspector | Inline in session runner | Side panel during active session |
| Statistics panel | Post-session in Dashboard | Real-time side panel for host during group session |
| Search overlay | Triggered by Cmd+K or entity link action | Always overlay, never full page |
| Schema type editor | `/#/cg/:libId/studio/schema/types/:kindId` | Overlay from entity editor "Add field" |
| Session runner | `/#/cg/:libId/session/:sessionId` | Fullscreen only (no overlay variant) |
| KnowScore progress | `/#/cg/:libId/dashboard` | Inline widget in Library overview |
| Character dialogue | Storyboard view in session runner | Preview panel in Quest editor |
| Library overview template | `/#/cg/:libId` | — |

### 12.1 Keyboard navigation requirements

- Tab / Shift+Tab moves focus through interactive elements.
- Arrow keys navigate lists, trees, graph canvas.
- Enter activates buttons and opens focused items.
- Escape closes overlays and returns focus to the triggering element.
- Cmd+K opens search overlay from anywhere.
- Cmd+Enter submits forms.

No action that can be performed with a mouse may be unavailable from the keyboard.

---

## 13. Design constraints

1. **No automatic decisions.** Whenever the system could decide for the user (entity auto-linking, auto-alias, schema inference), it shows a panel and lets the user decide. The system proposes; the user selects.

2. **Schema belongs to the user.** The system provides primitive types, edge mechanics, and knowledge-layer node types (Knowledge, Text, Topic). All EntityKinds and EdgeKinds are user-created.

3. **No library projection layer.** Libraries are the top-level container. Collections are not separate pages — they are inline filter states on Table view.

4. **Knowledge-first authoring.** The Topic editor is the primary way to build the graph. Direct entity editing is available, but onboarding for Teacher and Self-learner starts with Topic authoring — the graph grows from writing.

5. **Consistency anchor principle.** Entities serve as consistency anchors. When an entity is edited or its schema changes, all Knowledge nodes and Topics that link to it are flagged in the Pending list. Authors are informed but not blocked.

6. **No mode is mandatory.** A phone book library needs no Topics or revision. A vocabulary library needs no Knowledge graph. Everything is optional except the entity graph itself.

7. **Backwards compatibility.** No feature of `/#/cogita/...` is removed. The new implementation adds to the existing one.
