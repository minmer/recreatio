import { useEffect, useState } from 'react';
import { getAllOutcomes } from '../features/revision/outcomes';
import { computeKnowness } from '../features/revision/knowness';
import type { KnowScore, FacePair } from './nodeTypes';

type KnowScoreMap = Map<string, KnowScore>;

// Key is nodeId:stimulusRole:responseRole — one entry per unique review direction.
function scoreKey(nodeId: string, facePair: FacePair) {
  return `${nodeId}:${facePair.stimulusRole}:${facePair.responseRole}`;
}

// Collapses the global Outcome pool (IndexedDB) into a per-node KnowScore map.
// Re-runs whenever refreshTick changes — callers increment it to force a reload.
export function useKnowScores(refreshTick = 0): {
  scores: KnowScoreMap;
  loading: boolean;
} {
  const [scores, setScores] = useState<KnowScoreMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAllOutcomes().then((outcomes) => {
      if (cancelled) return;

      // Group by nodeId + facePair direction
      const groups = new Map<string, typeof outcomes>();
      for (const outcome of outcomes) {
        // Legacy outcomes store itemId as nodeId; facePair defaults to stimulus→response.
        const facePair: FacePair = { stimulusRole: 'stimulus', responseRole: 'response' };
        const key = scoreKey(outcome.itemId, facePair);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(outcome);
      }

      const result: KnowScoreMap = new Map();
      for (const [key, group] of groups.entries()) {
        const [nodeId, stimulusRole, responseRole] = key.split(':') as [string, string, string];
        const facePair: FacePair = {
          stimulusRole: stimulusRole as FacePair['stimulusRole'],
          responseRole: responseRole as FacePair['responseRole']
        };
        const summary = computeKnowness(group);
        const score: KnowScore = {
          nodeId,
          facePair,
          score: summary.score,
          avgCorrectness: summary.correct / Math.max(summary.total, 1),
          total: summary.total,
          correct: summary.correct,
          lastReviewedUtc: summary.lastReviewedUtc
        };
        result.set(key, score);
      }

      setScores(result);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [refreshTick]);

  return { scores, loading };
}

// Convenience: get the best score for a node across all face pairs.
export function getBestScore(scores: KnowScoreMap, nodeId: string): KnowScore | null {
  let best: KnowScore | null = null;
  for (const score of scores.values()) {
    if (score.nodeId !== nodeId) continue;
    if (best === null || score.score > best.score) best = score;
  }
  return best;
}

// Aggregate stats over a set of nodeIds.
export function aggregateScores(scores: KnowScoreMap, nodeIds: string[]): {
  known: number;  // nodes with score >= 80
  learning: number; // nodes with 30 <= score < 80
  unseen: number;   // nodes with score < 30 (or no outcome at all)
  total: number;
  avgScore: number;
} {
  const seen = new Set<string>();
  const perNode = new Map<string, number>();

  for (const score of scores.values()) {
    if (!nodeIds.includes(score.nodeId)) continue;
    const prev = perNode.get(score.nodeId) ?? 0;
    if (score.score > prev) perNode.set(score.nodeId, score.score);
    seen.add(score.nodeId);
  }

  let known = 0, learning = 0, sum = 0;
  for (const id of nodeIds) {
    const s = perNode.get(id) ?? 0;
    sum += s;
    if (s >= 80) known++;
    else if (s >= 30) learning++;
  }

  const total = nodeIds.length;
  const unseen = total - seen.size;

  return {
    known,
    learning,
    unseen,
    total,
    avgScore: total > 0 ? Math.round(sum / total) : 0
  };
}
