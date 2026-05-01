# Cogita — Design Thinking

This document collects the conceptual design discussions behind Cogita's evolution.
It is not a technical specification. It is a record of what was considered, what tensions
emerged, how they were resolved, and what remains open. Contradictions are preserved
because they represent real design pressure that shaped the decisions.

---

## 1. What Cogita is trying to be

Cogita is a knowledge system that bridges three activities: receiving information, building
understanding, and applying knowledge. These three are not sequential stages and not
distinct categories — they overlap, they co-evolve, and the same piece of knowledge can
live in all three at once. A learner who applies a concept is also deepening their
understanding of it. A teacher who writes an explanation is also testing and extending their
own knowledge.

The core problem with existing tools: flashcard systems treat knowledge as flat lists of
isolated facts. Course systems treat knowledge as linear sequences. Neither reflects how
knowledge actually behaves — as a graph with depth, dependency, and context.

Cogita tries to be a living knowledge graph that a learner navigates at their own depth,
with social and narrative layers that make the navigation meaningful and motivating.

---

## 2. The knowledge structure

### Notion — the atomic unit

A Notion is the smallest individually meaningful piece of knowledge. It can be a word, a
concept, a question, a quote, a formula. It has a type that determines its schema and what
revision cards can be generated from it.

**Tension considered:** Notions are sometimes too atomic. A vocabulary word and a theorem
are both Notions, but their depth of understanding works differently. A word is mostly
binary (known or not); a theorem has layers — statement, proof sketch, proof, applications,
connections to other theorems. This suggested a need for something between a single Notion
and a full Storyboard: a cluster of Notions that together constitute a meaningful concept
with multiple dimensions (What, Why, How, Context, Evidence, Contrast).

This middle layer was discussed but not yet fully resolved. One framing was that a
"Knowledge Node" is simply a well-connected cluster in the dependency graph — not a new
entity type, but an emergent property of well-linked Notions. Another framing was that it
should be an explicit entity so authors can declare dimensions intentionally.

### Storyboard — the narrative unit

A Storyboard is a curated sequence of Notions delivered with a narrative frame. It reads
like an authored document — a chapter, an episode in a story. The prolog sets the scene;
the epilog resolves it; the nodes in between carry the knowledge.

**Tension: Storyboard as learning vs. Storyboard as revision.**
Storyboards are excellent for first-encounter sequential learning. They are not well suited
to repetition, because they are static — they do not adapt to what a learner already knows,
do not handle revisiting well, and are isolated from each other (they do not know what the
learner has encountered in other storyboards).

The resolution proposed: adaptive storyboard elements. Two new node types were discussed:

- **Prerequisite node** — placed before a section that requires prior knowledge. Checks the
  learner's knowness. If the learner already knows the prerequisite, the node is skipped or
  compressed. If not, an explanation is injected. The injected explanation is a reusable
  unit, usable across multiple storyboards.

- **Expansion node** — attached to a specific term within a node. Activates only when the
  learner's knowness of that term is below a threshold. Delivers a brief inline explanation.
  The author marks terms as expansion-eligible; the runtime decides whether to expand.

These mechanisms mean the same authored storyboard produces different reading experiences
for different learners without requiring the author to write multiple versions of the full
content.

### The writing model — top-down authorship

A teacher does not write from the ground up. They understand the destination first —
the main claim, the culminating insight — and then write the prerequisites that support it.
This is how scientific papers are structured: the abstract states the conclusion; the body
explains the prerequisites; the introduction and conclusion frame the narrative.

**The equivalence discovered:** a Storyboard is an adaptive scientific paper.
The culminating node corresponds to the abstract and conclusion. The prerequisite and
expansion nodes correspond to the body sections that explain what the reader needs to follow
the argument. The prolog and epilog correspond to the introduction and conclusion.

A static paper gives every reader the same path regardless of prior knowledge. A Storyboard,
authored the same way, gives each reader the path they need based on their knowness.
The authoring model is identical. The reader experience is personalised.

**The recall problem:** the same knowledge requires different authorial intent depending on
whether the learner is encountering it for the first time or being reminded of it. These are
not just tonally different — they are epistemically different. A recall framing says "you
remember when..." and skips foundational context. A discovery framing cannot assume this.

The proposed resolution: one set of Notion nodes, with two authored prologs and epilogs —
one for discovery, one for recall. The runtime selects based on knowness at arrival time.
The authoring overhead is four short narrative pieces per storyboard, not two full
storyboards.

### Dependencies — the connective tissue

Knowledge connects to knowledge. Some Notions are prerequisites for others; some elaborate
on others; some provide context. These connections are what make a knowledge graph more than
a flat list.

The simplest representation: a typed directed edge between two Notions.

Types considered:
- **Prerequisite** — hard dependency; must know before the dependent can be understood
- **Elaboration** — soft; deepens understanding but is not blocking
- **Context** — situates the Notion in a broader domain; useful but not required

**The increment problem:** the main friction is not storing dependencies — it is getting
them declared without overburdening authors. Two mechanisms were proposed to reduce this
friction:

1. *Inferred from storyboard ordering* — if Notion A consistently appears before Notion B
   across multiple storyboards, the system infers A is a soft prerequisite for B. Authors
   already express ordering when they write storyboards; the inference extracts dependency
   information from decisions already made.

2. *Declared at character handoffs* — when a character says "go to her, she knows this
   better," the narrative redirect is already a dependency declaration. The author writes
   the handoff as a story choice; the system records the edge.

Explicit hard prerequisites should be reserved for cases where an author knows the
dependency is genuinely blocking — a deliberate, rare act rather than constant overhead.

### Collection — distribution, not structure

**Contradiction:** Collection was initially conceived as an organizational and structural
unit for Notions — a way to group related things, express ordering, and declare dependencies
between groups.

Through discussion, this role was reconsidered. If the dependency graph provides structure
and the character network provides narrative grouping, a Collection becomes a *distribution
artifact* — a named bundle for export and sharing with no internal dependency semantics.

The user's reaction was to accept this direction. The organizational meaning that Collection
once carried is better expressed by the knowledge graph itself (connected clusters, character
domains, arc tags). Collection becomes thin: a label and a list of Notion IDs.

---

## 3. The storytelling layer

### Characters as curriculum lenses

Characters are not mascots placed on top of content. A character is a specific perspective,
a set of interests, and a domain — a lens through which a subset of the knowledge graph
becomes meaningful. The same Notion about modular arithmetic looks different through a
security-focused character than through a pure-mathematics character. Same Notion, different
framing, different narrative reason for the learner to care.

**What characters do:**
- Provide a narrative reason for the learner to care about a Notion
- Own certain domains of the knowledge graph (their primary expertise)
- Form a social network that the learner navigates as they progress
- Deliver Storyboards as episodes in their ongoing story

### Two interaction modes

**Character invites** — the character has a problem and invites the learner to help. The
framing is collaborative and peer-to-peer. The learner is a participant, not a student. This
works best for application and game modes, where the character's problem is the challenge.

**User seeks** — the learner goes to a character because that character knows something they
need. The framing is mentor-apprentice: the character is the expert in their domain. This
works best for story and drill modes.

The same character can appear in both modes across different Storyboards. The shift in
register over time — from needing the learner's help early on, to being the established
expert later — is itself characterization. The learner witnesses a character's growth.

### The character network and handoffs

**Contradiction 1: Growing characters vs. fixed-age characters.**

Growing characters age alongside the learner. This creates strong emotional investment and
narrative consistency — the same characters are followed throughout the full curriculum.
But it creates a timeline problem: when an older learner accesses foundational content, the
storyboard is set when the characters were young, creating a mismatch between the learner's
current relationship with the characters and the narrative context.

Fixed-age characters each exist at one age permanently. The learner moves through the
character network as their knowledge grows. No timeline paradox exists: when an older
learner accesses foundational content, it is framed as a flashback or origin episode — seeing
where a character started, which adds emotional depth rather than causing confusion.

**The user's reaction:** fixed-age characters were accepted, with the addition that adult
characters are also valid. Age is internal authoring metadata — it is never shown as a
level indicator. What the learner sees is a character's name, domain, interests, and
relationships.

The handoff between characters is social, not mechanical. A character introduces the learner
to someone they know because the story led there, not because the system decided the learner
completed a level. The knowledge graph tracks what the learner actually knows. The character
graph tracks where the story is going. They influence each other but are not the same thing.

### Specialization with age

At early ages, characters have broadly overlapping interests — they are all broadly curious.
As they age, their domains diverge. This mirrors how expertise actually develops.

Consequences:
- Early characters can guide the learner through foundational content from multiple angles
- Later characters each own a narrower, deeper domain
- Cross-domain moments — when two specialists must work together — become narrative events
  that coincide with threshold concept crossings: the learner feels the significance of a
  connection because the characters have been distinct for a long time and now need each other

### Character relationships

**Contradiction 2: Directed vs. bidirectional relationships.**

The initial proposition modeled character relationships as directed edges — Character A
knows Character B and can send the learner to them. This is structurally clean but
narratively wrong. A friendship is mutual. The interesting question is not which direction
the connection goes but how *close* two characters are to each other — and whether that
closeness is symmetric.

**The user's challenge:** relationships should be open to bidirectional connections. The
closeness between two characters should determine how many and how confident the
recommendations are. An acquaintance gives a vague mention. A friend gives a confident
recommendation. A close collaborator gives multiple specific recommendations based on deep
knowledge of the other's domain.

Closeness can be asymmetric: Character A may consider Character B a close friend while B
considers A an acquaintance. This asymmetry is itself narrative information — it can drive
story tension, character development, and changes over time as the learner progresses.

**Resolution in progress:** the relationship model should store:
- A connection between any two characters (undirected at the structural level)
- Independent closeness values from each character's perspective (asymmetric)
- A relationship type that may be symmetric (friend, peer) or directional by nature (mentor,
  adversary)

The closeness values, not the edge direction, determine how many propositions the system
surfaces to the learner when one character refers to another.

---

## 4. The engagement model

Four modes of engagement, described as overlapping rather than sequential:

- **Receive** — encounter new knowledge through a Storyboard narrative
- **Check** — revision cards test and reinforce
- **Apply** — application challenges require using knowledge to solve problems
- **Contribute** — writing, explaining, or extending knowledge encodes it most deeply

These map to four system gears, each a full mode of interaction:

- **Story** — Storyboard reading, adaptive to the learner's knowness
- **Drill** — Spaced repetition revision within a domain
- **Live** — Synchronous multi-learner sessions
- **Game** — Application and competition challenges

**The Protégé Effect** was cited as grounding for the Contribute gear: the act of explaining
something to someone else is among the deepest encoding mechanisms. Writing an expansion
node, teaching another learner, contributing a new framing — these should be first-class
activities in the system, not secondary features.

---

## 5. Exploration and gamification

Knowledge navigation should feel like exploration, not course completion.

The metaphor proposed: a spatial map with fog of war. Known nodes reveal terrain; unknown
nodes show as silhouettes — visible but not legible. The learner's *frontier* — every node
whose prerequisites are met but which is not yet known — is always visible as the active
edge of their current knowledge.

Knowness decay is visualized spatially: nodes not reinforced recently appear weathered or
fading. Threshold concepts appear as landmark structures; crossing them transforms the map
and reveals new territory.

Community presence: other learners leave traces on the map. Nodes where many learners stall
surface as contribution opportunities. Contribution (writing an expansion node or explanation)
is a build action — the learner places something on the map that others will encounter.

**Tension: gamification mechanics vs. intrinsic motivation.**

External mechanics (badges, points, leaderboards) can undermine intrinsic motivation once
removed. The direction considered: all game mechanics should be *diegetic* — rooted in the
narrative and character layer, not imposed externally. An achievement matters because Alice
needed the learner's help and they delivered, not because the system awarded a badge.
The character's stakes become the learner's stakes.

This tension was not fully resolved. Some learners respond to external mechanics regardless
of theoretical concerns. The balance between diegetic and extrinsic motivators is an open
question.

---

## 6. Grounding in learning science

Several scientific frameworks shaped the discussion. They are listed here for reference,
not as prescriptions.

**Threshold concepts** (Meyer & Land) — certain concepts act as portals of understanding
that permanently transform a learner's perspective. Before crossing, the concept is
opaque or counterintuitive. After crossing, it cannot be "unknown." These concepts
naturally correspond to the landmark structures on the knowledge map.

**Situated learning** (Lave & Wenger) — knowledge is inseparable from the context in which
it is encountered and used. The character layer is a direct response to this: knowledge is
always encountered inside a character's problem, never as an abstract fact floating
outside context.

**Communities of Practice** (Lave & Wenger) — learning happens by moving from the
periphery of a practice community toward its center, guided by those who are slightly
ahead. The character network models this: the learner enters as a newcomer and moves
toward the center by following social relationships, not by completing levels.

**Generative learning** (Wittrock) and the **Protégé Effect** — explanation and
contribution are among the deepest encoding mechanisms. Writing is learning. The Contribute
gear is grounded here.

**Graph-aware spaced repetition** — if a prerequisite node's knowness decays below threshold,
the dependent nodes should be affected. A learner who forgets the foundation is effectively
losing partial access to what was built on top of it. The dependency graph makes this
mathematically expressible and practically actionable.

---

## 7. Open tensions and unresolved questions

**Character age visibility:** age is useful as an internal authoring signal for relatability
and narrative arc. Whether any version of it is visible to the learner — as a hint, as
narrative context, as relationship metadata — is unresolved. The risk is that it becomes a
hidden level indicator, which would undermine the intent.

**Knowledge Node as explicit entity vs. emergent graph cluster:** should the "knowledge
cluster" around a concept be a declared entity (with explicit dimensions: What, Why, How,
Context) or an emergent pattern in the dependency graph? Explicit allows intentional
authorship; emergent allows organic growth. Both have costs.

**Closeness values over time:** character relationships should evolve as the learner
progresses. A character who was an acquaintance in Arc 1 may be a close colleague in Arc 3.
How and when these values update — whether by narrative events, by learner progress
thresholds, or by time — is open.

**Contribution quality gate:** community-written expansion nodes and explanation nodes need
a quality mechanism. Voting was mentioned. The risk is that quality gating by popularity
introduces its own distortions (popular simplifications rated over accurate nuance).

**Recall vs. discovery routing:** the system should route a learner to the discovery prolog
on first encounter and to the recall prolog on subsequent encounters. The threshold between
"first encounter" and "already knows this" is knowness-based, but the exact threshold
requires empirical calibration.

---

## 8. What this document is not

This document does not specify:
- Database schema or entity field names
- API contract structure
- Frontend component hierarchy
- Implementation order or migration steps

Those decisions are driven by this document but recorded elsewhere. This document should
remain stable at the conceptual level even as the implementation evolves beneath it.
