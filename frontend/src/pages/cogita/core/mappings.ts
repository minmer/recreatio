// ─── Migration Mappings ───────────────────────────────────────────────────────
// Shows how every existing Cogita type maps onto the new Node/Space/Session
// primitives. These adapters allow the new types to coexist with legacy API
// responses during incremental migration — no big-bang rewrite required.
//
// Phase 1 (now): legacy code still runs; these functions let new UI consume old data.
// Phase 2: API gains native Node/Space/Session endpoints; adapters become no-ops.
// Phase 3: adapters removed, legacy types deleted.

import type {
  CogitaLibrary,
  CogitaCollectionSummary,
  CogitaRevision,
  CogitaNotionSearchResult
} from '../../../lib/api';
import type { RevisionOutcomePayload } from '../features/revision/outcomes';
import type {
  Node,
  NodeFace,
  Space,
  SpaceTemplate,
  Session,
  SessionMode,
  SessionAlgorithm,
  Outcome,
  FacePair,
  KnowScore
} from './nodeTypes';
import { computeKnowness } from '../features/revision/knowness';

// ─── Library → Space (root) ──────────────────────────────────────────────────

export function libraryToSpace(lib: CogitaLibrary, template?: SpaceTemplate | null): Space {
  return {
    spaceId: lib.libraryId,
    parentSpaceId: null,
    name: lib.name,
    description: null,
    template: template ?? null,
    members: [],
    nodeIds: [],
    childSpaceIds: [],
    assignments: [],
    createdUtc: lib.createdUtc,
    updatedUtc: lib.createdUtc
  };
}

// ─── Collection → Space (child) ──────────────────────────────────────────────

export function collectionToSpace(col: CogitaCollectionSummary, parentSpaceId: string): Space {
  return {
    spaceId: col.collectionId,
    parentSpaceId,
    name: col.name,
    description: col.notes ?? null,
    template: null,
    members: [],
    nodeIds: [],
    childSpaceIds: [],
    assignments: [],
    createdUtc: col.createdUtc,
    updatedUtc: col.createdUtc
  };
}

// ─── Notion search result → Node (stub) ──────────────────────────────────────
// Produces a minimal Node. Full face data requires a detail fetch.

export function notionResultToNode(result: CogitaNotionSearchResult, spaceId: string): Node {
  const labelFace: NodeFace = {
    faceId: `${result.notionId}-label`,
    role: 'stimulus',
    content: result.label,
    contentType: 'text'
  };
  return {
    nodeId: result.notionId,
    nodeType: result.notionType,
    faces: [labelFace],
    edges: [],
    payload: { label: result.label },
    spaceId,
    createdUtc: '',
    updatedUtc: ''
  };
}

// ─── Revision → Session ───────────────────────────────────────────────────────

const REVISION_MODE_MAP: Record<string, SessionMode> = {
  random: 'practice',
  'random-once': 'test',
  levels: 'practice',
  temporal: 'practice'
};

const REVISION_ALGO_MAP: Record<string, SessionAlgorithm> = {
  random: 'random',
  'random-once': 'random',
  levels: 'difficulty-adaptive',
  temporal: 'spaced-repetition'
};

export function revisionToSession(rev: CogitaRevision): Session {
  const mode: SessionMode = REVISION_MODE_MAP[rev.revisionType ?? ''] ?? 'practice';
  const algorithm: SessionAlgorithm = REVISION_ALGO_MAP[rev.revisionType ?? ''] ?? 'random';

  const defaultFacePair: FacePair = { stimulusRole: 'stimulus', responseRole: 'response' };

  return {
    sessionId: rev.revisionId,
    spaceId: rev.collectionId,
    name: rev.name,
    mode,
    scope: { kind: 'space', spaceId: rev.collectionId },
    settings: {
      algorithm,
      facePairs: [defaultFacePair],
      limit: rev.limit > 0 ? rev.limit : null,
      timePerCardMs: null,
      isRealtime: false,
      showLeaderboard: false,
      scriptId: null
    },
    createdUtc: rev.createdUtc,
    updatedUtc: rev.updatedUtc
  };
}

// ─── RevisionOutcomePayload → Outcome ─────────────────────────────────────────

export function legacyOutcomeToOutcome(
  payload: RevisionOutcomePayload,
  outcomeId: string
): Outcome {
  const correctness = payload.correct ? 1 : 0;
  const facePair: FacePair = { stimulusRole: 'stimulus', responseRole: 'response' };

  return {
    outcomeId,
    personRoleId: payload.personRoleId ?? '',
    nodeId: payload.itemId,
    facePair,
    correct: payload.correct,
    correctness,
    durationMs: payload.durationMs ?? null,
    sessionId: null,
    evalType: payload.evalType,
    createdUtc: payload.createdUtc,
    clientId: payload.clientId,
    clientSequence: payload.clientSequence,
    pending: false
  };
}

// ─── Outcomes → KnowScore ────────────────────────────────────────────────────

export function outcomesToKnowScore(
  nodeId: string,
  facePair: FacePair,
  outcomes: RevisionOutcomePayload[]
): KnowScore {
  const summary = computeKnowness(outcomes);
  return {
    nodeId,
    facePair,
    score: summary.score,
    avgCorrectness: summary.correct / Math.max(summary.total, 1),
    total: summary.total,
    correct: summary.correct,
    lastReviewedUtc: summary.lastReviewedUtc
  };
}
