import type {
  CogitaLiveRevisionPublicState,
  CogitaStatisticsParticipantSummary,
  CogitaStatisticsResponse,
  CogitaStatisticsTimelinePoint
} from '../../../lib/api';

function parseUtcToMillis(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildLiveStatisticsResponse(state: CogitaLiveRevisionPublicState | null): CogitaStatisticsResponse | null {
  if (!state) return null;

  const scoreboard = [...(state.scoreboard ?? [])];
  const scoreHistory = [...(state.scoreHistory ?? [])].sort((left, right) => {
    if ((left.roundIndex ?? 0) !== (right.roundIndex ?? 0)) {
      return (left.roundIndex ?? 0) - (right.roundIndex ?? 0);
    }
    return parseUtcToMillis(left.recordedUtc) - parseUtcToMillis(right.recordedUtc);
  });
  const correctnessHistory = [...(state.correctnessHistory ?? [])].sort((left, right) => {
    if ((left.roundIndex ?? 0) !== (right.roundIndex ?? 0)) {
      return (left.roundIndex ?? 0) - (right.roundIndex ?? 0);
    }
    return parseUtcToMillis(left.recordedUtc) - parseUtcToMillis(right.recordedUtc);
  });

  const scoreByRoundAndParticipant = new Map<string, number>();
  scoreHistory.forEach((round) => {
    (round.scoreboard ?? []).forEach((entry) => {
      const key = `${round.roundIndex}::${entry.participantId}`;
      scoreByRoundAndParticipant.set(key, Number(entry.score ?? 0));
    });
  });

  const participantMeta = new Map<
    string,
    {
      label: string;
      eventCount: number;
      answerCount: number;
      correctCount: number;
      runningPoints: number;
      knownessScore: number;
      lastActivityUtc?: string | null;
    }
  >();
  scoreboard.forEach((row) => {
    participantMeta.set(row.participantId, {
      label: row.displayName,
      eventCount: 0,
      answerCount: 0,
      correctCount: 0,
      runningPoints: 0,
      knownessScore: 0,
      lastActivityUtc: null
    });
  });

  const timeline: CogitaStatisticsTimelinePoint[] = [];
  let timelineIndex = 0;
  correctnessHistory.forEach((round) => {
    const entries = [...(round.entries ?? [])].sort((left, right) => parseUtcToMillis(left.submittedUtc) - parseUtcToMillis(right.submittedUtc));
    entries.forEach((entry) => {
      const participantId = String(entry.participantId ?? '').trim();
      if (!participantId) return;
      const existing = participantMeta.get(participantId);
      const meta =
        existing ??
        {
          label: entry.displayName || participantId,
          eventCount: 0,
          answerCount: 0,
          correctCount: 0,
          runningPoints: 0,
          knownessScore: 0,
          lastActivityUtc: null
        };

      meta.eventCount += 1;
      const correctness = typeof entry.isCorrect === 'boolean' ? (entry.isCorrect ? 1 : 0) : null;
      if (correctness !== null) {
        meta.answerCount += 1;
        if (correctness > 0) meta.correctCount += 1;
      }

      const pointsAwarded = Number.isFinite(entry.pointsAwarded) ? Number(entry.pointsAwarded) : 0;
      const runningFromScoreHistory = scoreByRoundAndParticipant.get(`${round.roundIndex}::${participantId}`);
      if (typeof runningFromScoreHistory === 'number' && Number.isFinite(runningFromScoreHistory)) {
        meta.runningPoints = runningFromScoreHistory;
      } else {
        meta.runningPoints += pointsAwarded;
      }
      meta.knownessScore = meta.answerCount > 0 ? (meta.correctCount / meta.answerCount) * 100 : 0;
      meta.lastActivityUtc = entry.submittedUtc ?? round.recordedUtc ?? meta.lastActivityUtc ?? null;
      meta.label = entry.displayName || meta.label || participantId;
      participantMeta.set(participantId, {
        ...meta
      });

      timeline.push({
        index: ++timelineIndex,
        recordedUtc: entry.submittedUtc ?? round.recordedUtc ?? new Date().toISOString(),
        participantKey: participantId,
        participantKind: 'participant',
        participantId,
        label: meta.label || participantId,
        eventType: 'answer',
        roundIndex: round.roundIndex ?? null,
        isCorrect: correctness === null ? null : correctness > 0,
        correctness,
        pointsAwarded,
        durationMs: null,
        runningPoints: meta.runningPoints,
        knownessScore: meta.knownessScore
      });
    });
  });

  if (timeline.length === 0 && scoreHistory.length > 0) {
    const previousScoreByParticipant = new Map<string, number>();
    scoreHistory.forEach((round) => {
      const roundRecordedUtc = round.recordedUtc ?? new Date().toISOString();
      (round.scoreboard ?? []).forEach((entry) => {
        const participantId = String(entry.participantId ?? '').trim();
        if (!participantId) return;
        const existing = participantMeta.get(participantId);
        const meta =
          existing ??
          {
            label: entry.displayName || participantId,
            eventCount: 0,
            answerCount: 0,
            correctCount: 0,
            runningPoints: 0,
            knownessScore: 0,
            lastActivityUtc: null
          };
        const currentScore = Number(entry.score ?? 0);
        const previousScore = previousScoreByParticipant.get(participantId) ?? 0;
        const pointsAwarded = currentScore - previousScore;
        previousScoreByParticipant.set(participantId, currentScore);
        meta.eventCount += 1;
        meta.runningPoints = currentScore;
        meta.lastActivityUtc = roundRecordedUtc;
        meta.label = entry.displayName || meta.label || participantId;
        participantMeta.set(participantId, { ...meta });
        timeline.push({
          index: ++timelineIndex,
          recordedUtc: roundRecordedUtc,
          participantKey: participantId,
          participantKind: 'participant',
          participantId,
          label: meta.label || participantId,
          eventType: 'score-snapshot',
          roundIndex: round.roundIndex ?? null,
          isCorrect: null,
          correctness: null,
          pointsAwarded,
          durationMs: null,
          runningPoints: currentScore,
          knownessScore: meta.knownessScore
        });
      });
    });
  }

  if (timeline.length === 0 && scoreboard.length > 0) {
    scoreboard.forEach((row) => {
      const participantId = String(row.participantId ?? '').trim();
      if (!participantId) return;
      const existing = participantMeta.get(participantId);
      const meta =
        existing ??
        {
          label: row.displayName || participantId,
          eventCount: 0,
          answerCount: 0,
          correctCount: 0,
          runningPoints: 0,
          knownessScore: 0,
          lastActivityUtc: null
        };
      const currentScore = Number(row.score ?? 0);
      meta.eventCount += 1;
      meta.runningPoints = currentScore;
      meta.lastActivityUtc = meta.lastActivityUtc ?? new Date().toISOString();
      meta.label = row.displayName || meta.label || participantId;
      participantMeta.set(participantId, { ...meta });
      timeline.push({
        index: ++timelineIndex,
        recordedUtc: meta.lastActivityUtc ?? new Date().toISOString(),
        participantKey: participantId,
        participantKind: 'participant',
        participantId,
        label: meta.label || participantId,
        eventType: 'score-final',
        roundIndex: null,
        isCorrect: null,
        correctness: null,
        pointsAwarded: currentScore,
        durationMs: null,
        runningPoints: currentScore,
        knownessScore: meta.knownessScore
      });
    });
  }

  const scoreboardByParticipant = new Map<string, number>();
  scoreboard.forEach((row) => {
    scoreboardByParticipant.set(row.participantId, Number(row.score ?? 0));
  });

  const participants: CogitaStatisticsParticipantSummary[] = Array.from(participantMeta.entries())
    .map(([participantKey, meta]) => {
      const totalPoints = scoreboardByParticipant.has(participantKey) ? Number(scoreboardByParticipant.get(participantKey) ?? 0) : meta.runningPoints;
      return {
        participantKey,
        participantKind: 'participant',
        personRoleId: null,
        participantId: participantKey,
        label: meta.label || participantKey,
        eventCount: meta.eventCount,
        answerCount: meta.answerCount,
        correctCount: meta.correctCount,
        averageCorrectness: meta.answerCount > 0 ? (meta.correctCount / meta.answerCount) * 100 : 0,
        totalPoints,
        lastActivityUtc: meta.lastActivityUtc ?? null,
        knownessScore: meta.knownessScore
      };
    })
    .sort((left, right) => right.totalPoints - left.totalPoints || left.label.localeCompare(right.label));

  const totalAnswers = participants.reduce((sum, participant) => sum + participant.answerCount, 0);
  const totalCorrectAnswers = participants.reduce((sum, participant) => sum + participant.correctCount, 0);
  const totalPoints = participants.reduce((sum, participant) => sum + participant.totalPoints, 0);

  return {
    scopeType: 'live-session',
    scopeId: state.sessionId,
    totalEvents: timeline.length,
    totalAnswers,
    totalCorrectAnswers,
    averageCorrectness: totalAnswers > 0 ? (totalCorrectAnswers / totalAnswers) * 100 : 0,
    totalPoints,
    participants,
    timeline,
    bestKnownWords: [],
    worstKnownWords: []
  };
}
