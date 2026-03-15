import type { CogitaCoreRunState, CogitaCoreRunStatistics } from '../../../../../../lib/api';
import { REVISION_PRIMITIVE_DEFAULT_LABELS } from './RevisionProgress';

export type RevisionStatisticsModel = {
  totalCards: number;
  completionPct: number;
  attempts: number;
  correct: number;
  wrong: number;
  blank: number;
  knownessPct: number;
  totalPoints: number;
  participantCount: number;
  connectedCount: number;
};

export type RevisionStatisticsLabels = {
  attemptsLabel?: string;
  correctLabel?: string;
  wrongLabel?: string;
  blankLabel?: string;
  knownessLabel?: string;
  pointsLabel?: string;
  completionLabel?: string;
  participantsLabel?: string;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function buildRevisionStatisticsModel(payload: {
  runState?: CogitaCoreRunState | null;
  statistics?: CogitaCoreRunStatistics | null;
}): RevisionStatisticsModel | null {
  const runState = payload.runState ?? null;
  const statistics = payload.statistics ?? null;
  if (!runState && !statistics) {
    return null;
  }

  const totalCardsFromRun = Number(runState?.run.totalCards ?? 0);
  const totalCardsFromTimeline = Array.from(
    new Set(
      (statistics?.timeline ?? [])
        .map((entry) => String(entry.cardKey ?? '').trim())
        .filter((entry) => entry.length > 0)
    )
  ).length;
  const totalCards = Math.max(totalCardsFromRun, totalCardsFromTimeline);

  const attempts = Math.max(
    Number(runState?.participantProgress.attemptCount ?? 0),
    Number(statistics?.totalAttempts ?? 0)
  );
  const completionPctFromRun = Number(runState?.participantProgress.completionPct ?? 0);
  const completionPct =
    completionPctFromRun > 0
      ? clampPercent(completionPctFromRun)
      : totalCards > 0
        ? clampPercent((attempts / totalCards) * 100)
        : 0;

  const participantCount = Math.max(
    Number(runState?.participants.length ?? 0),
    Number(statistics?.participants.length ?? 0)
  );
  const connectedCount = Number((runState?.participants ?? []).filter((item) => item.isConnected).length);

  return {
    totalCards,
    completionPct,
    attempts,
    correct: Number(statistics?.totalCorrect ?? runState?.participantProgress.correctCount ?? 0),
    wrong: Number(statistics?.totalWrong ?? runState?.participantProgress.wrongCount ?? 0),
    blank: Number(statistics?.totalBlankTimeout ?? runState?.participantProgress.blankTimeoutCount ?? 0),
    knownessPct: Number(statistics?.knownessScore ?? 0),
    totalPoints: Number(statistics?.totalPoints ?? 0),
    participantCount,
    connectedCount
  };
}

export function RevisionStatistics({
  stats,
  title,
  labels,
  emptyLabel
}: {
  stats: RevisionStatisticsModel | null;
  title?: string;
  labels?: RevisionStatisticsLabels;
  emptyLabel?: string;
}) {
  const resolvedLabels = {
    attemptsLabel: labels?.attemptsLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.attemptsLabel,
    correctLabel: labels?.correctLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.correctLabel,
    wrongLabel: labels?.wrongLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.wrongLabel,
    blankLabel: labels?.blankLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.blankLabel,
    knownessLabel: labels?.knownessLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.knownessLabel,
    pointsLabel: labels?.pointsLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.pointsLabel,
    completionLabel: labels?.completionLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.completionLabel,
    participantsLabel: labels?.participantsLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.participantsLabel
  };

  if (!stats) {
    return (
      <article className="cogita-core-run-stats">
        <p className="cogita-core-run-kicker">{title ?? REVISION_PRIMITIVE_DEFAULT_LABELS.statisticsTitle}</p>
        <p>{emptyLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.noStatisticsLabel}</p>
      </article>
    );
  }

  return (
    <article className="cogita-core-run-stats">
      <p className="cogita-core-run-kicker">{title ?? REVISION_PRIMITIVE_DEFAULT_LABELS.statisticsTitle}</p>
      <div className="cogita-core-run-stat-grid">
        <div>
          <small>{resolvedLabels.attemptsLabel}</small>
          <strong>{stats.attempts}</strong>
        </div>
        <div>
          <small>{resolvedLabels.correctLabel}</small>
          <strong>{stats.correct}</strong>
        </div>
        <div>
          <small>{resolvedLabels.wrongLabel}</small>
          <strong>{stats.wrong}</strong>
        </div>
        <div>
          <small>{resolvedLabels.blankLabel}</small>
          <strong>{stats.blank}</strong>
        </div>
        <div>
          <small>{resolvedLabels.knownessLabel}</small>
          <strong>{stats.knownessPct.toFixed(2)}%</strong>
        </div>
        <div>
          <small>{resolvedLabels.pointsLabel}</small>
          <strong>{stats.totalPoints}</strong>
        </div>
        <div>
          <small>{resolvedLabels.completionLabel}</small>
          <strong>{stats.completionPct.toFixed(1)}%</strong>
        </div>
        <div>
          <small>{resolvedLabels.participantsLabel}</small>
          <strong>{stats.connectedCount > 0 ? `${stats.connectedCount}/${stats.participantCount}` : stats.participantCount}</strong>
        </div>
      </div>
    </article>
  );
}
