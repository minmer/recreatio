// ─── Node ────────────────────────────────────────────────────────────────────
// Atomic knowledge unit. Replaces Info (Notion) and Connection entities.
// A Node has named Faces (the surfaces shown during review) and typed Edges
// (semantic relationships to other Nodes). Everything reviewable is a Node.

export type NodeFaceRole =
  | 'stimulus'   // the question side shown to the learner
  | 'response'   // the answer side expected from the learner
  | 'info'       // supplementary context, never the primary test target
  | 'audio'
  | 'image';

export type NodeFaceContentType = 'text' | 'markdown' | 'html' | 'latex';

export type NodeFace = {
  faceId: string;
  role: NodeFaceRole;
  content: string;
  contentType: NodeFaceContentType;
  languageId?: string | null;
};

export type NodeEdgeKind =
  | 'requires'      // prerequisite — learner should know the target before this
  | 'exemplifies'   // this node is a concrete example of the target concept
  | 'translates'    // bilingual equivalence (replaces translation connection)
  | 'part-of'       // compositional membership (word in sentence, chapter in book)
  | 'relates'       // weak semantic link
  | 'antonym'
  | 'synonym';

export type NodeEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: NodeEdgeKind;
  weight?: number | null;
};

// nodeType mirrors the existing CogitaInfoType values so existing data maps cleanly.
// payload preserves the per-type field bag (lemma, doi, text, etc.).
export type Node = {
  nodeId: string;
  nodeType: string;
  faces: NodeFace[];
  edges: NodeEdge[];
  payload: Record<string, unknown>;
  spaceId: string;
  createdUtc: string;
  updatedUtc: string;
};

// ─── FacePair ────────────────────────────────────────────────────────────────
// Identifies one review direction: show stimulusRole, expect responseRole.
// A single Node can support multiple FacePairs (e.g. A→B and B→A).

export type FacePair = {
  stimulusRole: NodeFaceRole;
  responseRole: NodeFaceRole;
};

// ─── Space ───────────────────────────────────────────────────────────────────
// Recursive container. A root Space is what was called a Library.
// Child Spaces are what was called Collections — but now they can nest.
// Members and assignments live at any level; children inherit from parents.

export type SpaceTemplate =
  | 'vocabulary'
  | 'knowledgeMap'
  | 'course'
  | 'research'
  | 'flashcards'
  | 'custom';

export type SpaceMemberRole = 'author' | 'teacher' | 'learner' | 'guest';

export type SpaceMember = {
  personRoleId: string;
  role: SpaceMemberRole;
  joinedUtc: string;
};

export type SpaceAssignment = {
  assignmentId: string;
  targetSpaceId: string;
  assignedToPersonRoleId: string;
  dueUtc?: string | null;
  note?: string | null;
  createdUtc: string;
};

export type Space = {
  spaceId: string;
  parentSpaceId?: string | null;
  name: string;
  description?: string | null;
  template?: SpaceTemplate | null;
  members: SpaceMember[];
  nodeIds: string[];
  childSpaceIds: string[];
  assignments: SpaceAssignment[];
  createdUtc: string;
  updatedUtc: string;
};

// ─── Session ─────────────────────────────────────────────────────────────────
// A single engagement event. Replaces Revision, LiveRevisionSession,
// StoryboardSession and Game — which are all "modes" of the same concept.
//
//   study     → self-paced reading / flashcard browse (no scoring)
//   practice  → scored drill (was: Revision random/levels/temporal)
//   test      → scored, no hints, time-limited (was: Revision random-once)
//   present   → teacher shows content to a group (was: StoryboardSession)
//   play      → competitive real-time (was: LiveRevisionSession / Game)
//   write     → open-ended authoring during a session (was: WritingRuntime)

export type SessionMode = 'study' | 'practice' | 'test' | 'present' | 'play' | 'write';

export type SessionAlgorithm =
  | 'sequential'
  | 'spaced-repetition'   // uses temporal knowness score
  | 'random'
  | 'difficulty-adaptive' // surfaces low-KnowScore nodes first
  | 'dependency-first';   // follows NodeEdge 'requires' graph

export type SessionScope =
  | { kind: 'space'; spaceId: string }
  | { kind: 'nodes'; nodeIds: string[] }
  | { kind: 'face-pairs'; facePairs: FacePair[] };

export type SessionSettings = {
  algorithm: SessionAlgorithm;
  facePairs?: FacePair[] | null;
  limit?: number | null;
  timePerCardMs?: number | null;
  isRealtime?: boolean;
  showLeaderboard?: boolean;
  scriptId?: string | null;
};

export type Session = {
  sessionId: string;
  spaceId: string;
  name: string;
  mode: SessionMode;
  scope: SessionScope;
  settings: SessionSettings;
  createdUtc: string;
  updatedUtc: string;
};

// ─── Outcome ─────────────────────────────────────────────────────────────────
// A single review event for one Node+FacePair by one person.
// Global pool — not scoped to a revision — so KnowScore is universal.
// Maps to the existing RevisionOutcomePayload; adds nodeId + facePair.

export type Outcome = {
  outcomeId: string;
  personRoleId: string;
  nodeId: string;
  facePair: FacePair;
  correct: boolean;
  correctness: number;  // 0–1 continuous (from slider / mask bytes)
  durationMs?: number | null;
  sessionId?: string | null;
  evalType: string;
  createdUtc: string;
  clientId: string;
  clientSequence: number;
  pending?: boolean;
};

// ─── Character ───────────────────────────────────────────────────────────────
// Persistent persona that can appear inside Scripts.
// Provides contextual feedback through conditional dialogues.

export type CharacterEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'excited'
  | 'confused'
  | 'encouraging';

export type DialogueTrigger =
  | 'session-start'
  | 'session-end'
  | 'correct'
  | 'incorrect'
  | 'streak-3'
  | 'streak-5'
  | 'custom';

export type CharacterDialogue = {
  dialogueId: string;
  trigger: DialogueTrigger;
  condition?: string | null;  // optional expression evaluated at runtime
  text: string;
  emotion: CharacterEmotion;
};

export type Character = {
  characterId: string;
  name: string;
  avatarUrl?: string | null;
  dialogues: CharacterDialogue[];
  createdUtc: string;
  updatedUtc: string;
};

// ─── Script ──────────────────────────────────────────────────────────────────
// Narrative overlay attached to a Session.
// Acts fire at specific points (session lifecycle or card sequence position).
// Replaces the current storyboard node/slide structure.

export type ActScope =
  | 'session-start'
  | 'session-end'
  | 'after-n-cards'   // scopeValue = n
  | 'node-sequence';  // fires when the listed nodeIds are presented

export type ScriptReaction = {
  trigger: 'correct' | 'incorrect' | 'custom';
  text: string;
  emotion: CharacterEmotion;
};

export type ScriptAct = {
  actId: string;
  scope: ActScope;
  scopeValue?: number | null;
  nodeIds?: string[] | null;
  characterId: string;
  openingText: string;
  closingText?: string | null;
  reactions?: ScriptReaction[] | null;
};

export type Script = {
  scriptId: string;
  spaceId: string;
  name: string;
  description?: string | null;
  acts: ScriptAct[];
  createdUtc: string;
  updatedUtc: string;
};

// ─── KnowScore ───────────────────────────────────────────────────────────────
// Derived view over the global Outcome pool for a single person+node+facePair.
// Computed client-side via the existing temporalKnowness algorithm.

export type KnowScore = {
  nodeId: string;
  facePair: FacePair;
  score: number;          // 0–100
  avgCorrectness: number; // 0–1
  total: number;
  correct: number;
  lastReviewedUtc?: string | null;
};
