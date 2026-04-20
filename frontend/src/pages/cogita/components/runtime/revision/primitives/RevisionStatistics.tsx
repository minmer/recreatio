import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCogitaStatistics, type CogitaStatisticsResponse, type CogitaStatisticsTimelinePoint } from '../../../../../../lib/api';
import { copy as appCopy } from '../../../../../../content';
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

const PARTICIPANT_COLORS = [
  '#70c6ff',
  '#7af2d6',
  '#f0bf6f',
  '#d58fff',
  '#8feea1',
  '#f48ea5',
  '#9ac8ff',
  '#ffc48e'
];

type ParticipantSeriesPoint = {
  sequence: number;
  index: number;
  recordedAtMs: number | null;
  eventType: string;
  roundIndex: number | null;
  answersSeen: number;
  knowness: number;
  runningPoints: number;
  correctness: number | null;
  durationSeconds: number | null;
  pointsAwarded: number;
};

type ParticipantSeries = {
  key: string;
  label: string;
  color: string;
  totalPoints: number;
  totalDurationSeconds: number | null;
  averageCorrectness: number;
  averageDurationSeconds: number | null;
  averageCorrectDurationSeconds: number | null;
  averageWrongDurationSeconds: number | null;
  totalCorrectDurationSeconds: number | null;
  totalWrongDurationSeconds: number | null;
  averagePointsPerCorrectAnswer: number;
  averageBasePointsPerCorrectAnswer: number;
  averageFirstBonusPointsPerCorrectAnswer: number;
  averageSpeedBonusPointsPerCorrectAnswer: number;
  averageStreakBonusPointsPerCorrectAnswer: number;
  answerCount: number;
  correctCount: number;
  points: ParticipantSeriesPoint[];
};

type AnswerEventPoint = {
  participantKey: string;
  participantLabel: string;
  color: string;
  index: number;
  roundIndex: number | null;
  correctness: number;
  durationSeconds: number | null;
  pointsAwarded: number;
};

type FlowTransition = {
  from: string;
  to: string;
  count: number;
};

type StreamBandPoint = {
  round: number;
  x: number;
  y0: number;
  y1: number;
  value: number;
};

type StreamBand = {
  key: string;
  label: string;
  color: string;
  points: StreamBandPoint[];
};

type NumberedStatistic = {
  label: string;
  value: string;
};

type KnownessWordItem = {
  infoId: string;
  infoType: string;
  label: string;
  answerCount: number;
  correctCount: number;
  averageCorrectness: number;
  knownessScore: number;
};

type StatisticsContext = {
  response: CogitaStatisticsResponse;
  timeline: CogitaStatisticsTimelinePoint[];
  participantSeries: ParticipantSeries[];
  answerEvents: AnswerEventPoint[];
  transitions: FlowTransition[];
  rounds: number[];
  streamBands: StreamBand[];
  numberedStats: NumberedStatistic[];
  averageDurationSeconds: number | null;
  medianDurationSeconds: number | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  bestKnownWords: KnownessWordItem[];
  worstKnownWords: KnownessWordItem[];
};

type StatisticsModule = {
  id: string;
  title: string;
  subtitle: string;
  isAvailable: (context: StatisticsContext) => boolean;
  render: (context: StatisticsContext, controls: StatisticsRenderControls) => ReactNode;
};

type StatisticsRenderControls = {
  allParticipantSeries: ParticipantSeries[];
  visibleParticipantKeys: Set<string>;
  focusedParticipantKey: string | null;
  onToggleParticipantVisibility: (participantKey: string) => void;
  onHoverParticipant: (participantKey: string | null) => void;
  onToggleParticipantFocus: (participantKey: string) => void;
  timePyramidSortKey: 'name' | 'total' | 'left' | 'right';
  timePyramidSortDirection: 'asc' | 'desc';
  setTimePyramidSort: (key: 'name' | 'total' | 'left' | 'right') => void;
  labels: {
    participant: string;
    total: string;
    left: string;
    right: string;
    asc: string;
    desc: string;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function formatFloat(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0';
}

function formatCount(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

function resolveUiLanguage() {
  const lang = typeof document !== 'undefined' ? (document.documentElement.lang || 'en').toLowerCase() : 'en';
  if (lang.startsWith('pl')) return 'pl';
  if (lang.startsWith('de')) return 'de';
  return 'en';
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}

function getStatisticsUiText() {
  return appCopy[resolveUiLanguage()].cogita.library.statistics;
}

function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return 'n/a';
  if (value >= 3600) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  return `${formatFloat(value, 1)} s`;
}

function toSafeNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeKnownessWords(source: CogitaStatisticsResponse['bestKnownWords'] | CogitaStatisticsResponse['worstKnownWords']) {
  return (source ?? [])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      notionId: String(item.notionId ?? ''),
      notionType: String(item.notionType ?? ''),
      label: String(item.label ?? '').trim() || String(item.notionType ?? 'word'),
      answerCount: Number.isFinite(item.answerCount) ? Math.max(0, Number(item.answerCount)) : 0,
      correctCount: Number.isFinite(item.correctCount) ? Math.max(0, Number(item.correctCount)) : 0,
      averageCorrectness: Number.isFinite(item.averageCorrectness) ? clamp(Number(item.averageCorrectness), 0, 100) : 0,
      knownessScore: Number.isFinite(item.knownessScore) ? clamp(Number(item.knownessScore), 0, 100) : 0
    }))
    .filter((item) => item.notionId.length > 0);
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function buildAreaPath(upper: Array<{ x: number; y: number }>, lower: Array<{ x: number; y: number }>) {
  if (upper.length === 0 || lower.length === 0) return '';
  const top = upper.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const bottom = [...lower]
    .reverse()
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  return `${top} ${bottom} Z`;
}

function normalizeEventType(value: string) {
  if (!value) return 'event';
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'event';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function makeStatisticsContext(response: CogitaStatisticsResponse): StatisticsContext {
  const timeline = [...(response.timeline ?? [])]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((point) => point.participantKey && point.participantKey !== 'system');

  const participantOrder = [
    ...response.participants.filter((participant) => participant.participantKind !== 'system').map((participant) => participant.participantKey),
    ...timeline.map((point) => point.participantKey)
  ].filter((value, index, array) => array.indexOf(value) === index);

  const colorByParticipant = new Map<string, string>();
  participantOrder.forEach((participantKey, index) => {
    colorByParticipant.set(participantKey, PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]);
  });

  const timelineByParticipant = new Map<string, CogitaStatisticsTimelinePoint[]>();
  timeline.forEach((point) => {
    const bucket = timelineByParticipant.get(point.participantKey) ?? [];
    bucket.push(point);
    timelineByParticipant.set(point.participantKey, bucket);
  });

  const labelByParticipant = new Map<string, string>();
  response.participants.forEach((participant) => {
    labelByParticipant.set(participant.participantKey, participant.label);
  });
  timeline.forEach((point) => {
    if (!labelByParticipant.has(point.participantKey) && point.label) {
      labelByParticipant.set(point.participantKey, point.label);
    }
  });

  const participantSeries: ParticipantSeries[] = participantOrder
    .map((participantKey) => {
      const summary = response.participants.find((participant) => participant.participantKey === participantKey);
      const entries = timelineByParticipant.get(participantKey) ?? [];
      let answersSeen = 0;
      const points = entries.map((point, sequence) => {
        let correctness: number | null = null;
        if (typeof point.correctness === 'number' && Number.isFinite(point.correctness)) {
          correctness = clamp(point.correctness, 0, 1);
        } else if (typeof point.isCorrect === 'boolean') {
          correctness = point.isCorrect ? 1 : 0;
        }
        if (correctness !== null) {
          answersSeen += 1;
        }
        const durationSeconds =
          typeof point.durationMs === 'number' && Number.isFinite(point.durationMs) && point.durationMs > 0
            ? point.durationMs / 1000
            : typeof (point as any).durationSeconds === 'number' && Number.isFinite((point as any).durationSeconds)
            ? Math.max(0, Number((point as any).durationSeconds))
            : typeof (point as any).answerDurationMs === 'number' && Number.isFinite((point as any).answerDurationMs)
            ? Math.max(0, Number((point as any).answerDurationMs) / 1000)
            : null;
        const recordedAtMsRaw = Date.parse(point.recordedUtc);
        const recordedAtMs = Number.isFinite(recordedAtMsRaw) ? recordedAtMsRaw : null;
        const pointsAwarded = typeof point.pointsAwarded === 'number' && Number.isFinite(point.pointsAwarded) ? point.pointsAwarded : 0;
        return {
          sequence,
          index: point.index ?? sequence + 1,
          recordedAtMs,
          eventType: point.eventType ?? 'event',
          roundIndex: typeof point.roundIndex === 'number' ? point.roundIndex : null,
          answersSeen,
          knowness: typeof point.knownessScore === 'number' && Number.isFinite(point.knownessScore) ? point.knownessScore : 0,
          runningPoints: typeof point.runningPoints === 'number' && Number.isFinite(point.runningPoints) ? point.runningPoints : 0,
          correctness,
          durationSeconds,
          pointsAwarded
        } satisfies ParticipantSeriesPoint;
      });

      // Fill missing durations on the fly from per-participant answer timestamps.
      const answerPointIndexes = points
        .map((point, index) => ({ point, index }))
        .filter(({ point }) => point.correctness !== null)
        .map(({ index }) => index);
      for (let i = 0; i < answerPointIndexes.length; i += 1) {
        const currentIndex = answerPointIndexes[i];
        const currentPoint = points[currentIndex];
        if (typeof currentPoint.durationSeconds === 'number' && Number.isFinite(currentPoint.durationSeconds)) {
          continue;
        }
        let derivedDuration: number | null = null;
        const nextAnswerIndex = answerPointIndexes[i + 1];
        if (typeof nextAnswerIndex === 'number') {
          const nextPoint = points[nextAnswerIndex];
          if (currentPoint.recordedAtMs !== null && nextPoint.recordedAtMs !== null) {
            const delta = (nextPoint.recordedAtMs - currentPoint.recordedAtMs) / 1000;
            if (Number.isFinite(delta) && delta >= 0) {
              derivedDuration = delta;
            }
          }
        }
        if (
          derivedDuration === null &&
          typeof summary?.averageDurationMs === 'number' &&
          Number.isFinite(summary.averageDurationMs) &&
          summary.averageDurationMs > 0
        ) {
          derivedDuration = summary.averageDurationMs / 1000;
        }
        currentPoint.durationSeconds = derivedDuration;
      }

      const computedAnswerCount = summary?.answerCount ?? points.filter((point) => point.correctness !== null).length;
      const computedTotalDurationSeconds = (() => {
        const total = points
          .map((point) => point.durationSeconds)
          .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0)
          .reduce((sum, duration) => sum + duration, 0);
        if (total > 0) return total;
        if (
          typeof summary?.averageDurationMs === 'number' &&
          Number.isFinite(summary.averageDurationMs) &&
          summary.averageDurationMs > 0 &&
          computedAnswerCount > 0
        ) {
          return (summary.averageDurationMs / 1000) * computedAnswerCount;
        }
        return null;
      })();

      const computedAverageDurationSeconds = (() => {
        const durations = points
          .map((point) => point.durationSeconds)
          .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration > 0);
        if (durations.length > 0) {
          return mean(durations);
        }
        if (computedTotalDurationSeconds !== null && computedTotalDurationSeconds > 0 && computedAnswerCount > 0) {
          return computedTotalDurationSeconds / computedAnswerCount;
        }
        if (
          typeof summary?.averageDurationMs === 'number' &&
          Number.isFinite(summary.averageDurationMs) &&
          summary.averageDurationMs > 0
        ) {
          return summary.averageDurationMs / 1000;
        }
        return null;
      })();

      return {
        key: participantKey,
        label: summary?.label ?? labelByParticipant.get(participantKey) ?? participantKey,
        color: colorByParticipant.get(participantKey) ?? PARTICIPANT_COLORS[0],
        totalPoints: summary?.totalPoints ?? (points.length > 0 ? points[points.length - 1].runningPoints : 0),
        totalDurationSeconds: computedTotalDurationSeconds,
        averageCorrectness: summary?.averageCorrectness ?? 0,
        averageDurationSeconds: computedAverageDurationSeconds,
        averageCorrectDurationSeconds: (() => {
          const durations = points
            .filter((point) => point.correctness !== null && point.correctness >= 0.5)
            .map((point) => point.durationSeconds)
            .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
          return durations.length > 0 ? mean(durations) : null;
        })(),
        averageWrongDurationSeconds: (() => {
          const durations = points
            .filter((point) => point.correctness !== null && point.correctness < 0.5)
            .map((point) => point.durationSeconds)
            .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
          return durations.length > 0 ? mean(durations) : null;
        })(),
        totalCorrectDurationSeconds: (() => {
          const durations = points
            .filter((point) => point.correctness !== null && point.correctness >= 0.5)
            .map((point) => point.durationSeconds)
            .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
          return durations.length > 0 ? durations.reduce((sum, duration) => sum + duration, 0) : null;
        })(),
        totalWrongDurationSeconds: (() => {
          const durations = points
            .filter((point) => point.correctness !== null && point.correctness < 0.5)
            .map((point) => point.durationSeconds)
            .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
          return durations.length > 0 ? durations.reduce((sum, duration) => sum + duration, 0) : null;
        })(),
        averagePointsPerCorrectAnswer:
          (() => {
            if (typeof summary?.averagePointsPerCorrectAnswer === 'number' && Number.isFinite(summary.averagePointsPerCorrectAnswer) && summary.averagePointsPerCorrectAnswer > 0) {
              return summary.averagePointsPerCorrectAnswer;
            }
            const correctPointAwards = points
              .filter((point) => (point.correctness ?? 0) >= 0.5)
              .map((point) => point.pointsAwarded)
              .filter((value) => Number.isFinite(value) && value > 0);
            if (correctPointAwards.length > 0) {
              return mean(correctPointAwards);
            }
            const correctCount = summary?.correctCount ?? points.filter((point) => (point.correctness ?? 0) >= 0.5).length;
            if (correctCount > 0) {
              const totalPoints = summary?.totalPoints ?? (points.length > 0 ? points[points.length - 1].runningPoints : 0);
              return Math.max(0, totalPoints / correctCount);
            }
            return 0;
          })(),
        averageBasePointsPerCorrectAnswer:
          (() => {
            if (typeof summary?.averageBasePointsPerCorrectAnswer === 'number' && Number.isFinite(summary.averageBasePointsPerCorrectAnswer) && summary.averageBasePointsPerCorrectAnswer > 0) {
              return summary.averageBasePointsPerCorrectAnswer;
            }
            if (typeof summary?.averagePointsPerCorrectAnswer === 'number' && Number.isFinite(summary.averagePointsPerCorrectAnswer) && summary.averagePointsPerCorrectAnswer > 0) {
              return summary.averagePointsPerCorrectAnswer;
            }
            const correctPointAwards = points
              .filter((point) => (point.correctness ?? 0) >= 0.5)
              .map((point) => point.pointsAwarded)
              .filter((value) => Number.isFinite(value) && value > 0);
            if (correctPointAwards.length > 0) {
              return mean(correctPointAwards);
            }
            const correctCount = summary?.correctCount ?? points.filter((point) => (point.correctness ?? 0) >= 0.5).length;
            if (correctCount > 0) {
              const totalPoints = summary?.totalPoints ?? (points.length > 0 ? points[points.length - 1].runningPoints : 0);
              return Math.max(0, totalPoints / correctCount);
            }
            return 0;
          })(),
        averageFirstBonusPointsPerCorrectAnswer: (() => {
          const value = typeof summary?.averageFirstBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageFirstBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageFirstBonusPointsPerCorrectAnswer)
              : 0;
          return value;
        })(),
        averageSpeedBonusPointsPerCorrectAnswer: (() => {
          const avgPoints =
            typeof summary?.averagePointsPerCorrectAnswer === 'number' && Number.isFinite(summary.averagePointsPerCorrectAnswer)
              ? Math.max(0, summary.averagePointsPerCorrectAnswer)
              : 0;
          const avgBase =
            typeof summary?.averageBasePointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageBasePointsPerCorrectAnswer)
              ? Math.max(0, summary.averageBasePointsPerCorrectAnswer)
              : 0;
          const first =
            typeof summary?.averageFirstBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageFirstBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageFirstBonusPointsPerCorrectAnswer)
              : 0;
          const explicitSpeed =
            typeof summary?.averageSpeedBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageSpeedBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageSpeedBonusPointsPerCorrectAnswer)
              : 0;
          const explicitStreak =
            typeof summary?.averageStreakBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageStreakBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageStreakBonusPointsPerCorrectAnswer)
              : 0;
          if (explicitSpeed > 0) return explicitSpeed;
          const residual = avgPoints - avgBase - first - explicitStreak;
          return residual > 0 ? residual : 0;
        })(),
        averageStreakBonusPointsPerCorrectAnswer: (() => {
          const explicitStreak =
            typeof summary?.averageStreakBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageStreakBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageStreakBonusPointsPerCorrectAnswer)
              : 0;
          if (explicitStreak > 0) return explicitStreak;
          const avgPoints =
            typeof summary?.averagePointsPerCorrectAnswer === 'number' && Number.isFinite(summary.averagePointsPerCorrectAnswer)
              ? Math.max(0, summary.averagePointsPerCorrectAnswer)
              : 0;
          const avgBase =
            typeof summary?.averageBasePointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageBasePointsPerCorrectAnswer)
              ? Math.max(0, summary.averageBasePointsPerCorrectAnswer)
              : 0;
          const first =
            typeof summary?.averageFirstBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageFirstBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageFirstBonusPointsPerCorrectAnswer)
              : 0;
          const speed =
            typeof summary?.averageSpeedBonusPointsPerCorrectAnswer === 'number' &&
            Number.isFinite(summary.averageSpeedBonusPointsPerCorrectAnswer)
              ? Math.max(0, summary.averageSpeedBonusPointsPerCorrectAnswer)
              : 0;
          const residual = avgPoints - avgBase - first - speed;
          return residual > 0 ? residual : 0;
        })(),
        answerCount: computedAnswerCount,
        correctCount: summary?.correctCount ?? points.filter((point) => (point.correctness ?? 0) >= 0.5).length,
        points
      } satisfies ParticipantSeries;
    })
    .filter((participant) => participant.points.length > 0 || participant.answerCount > 0);

  participantSeries.sort((left, right) => right.totalPoints - left.totalPoints || left.label.localeCompare(right.label));
  participantSeries.forEach((participant, index) => {
    participant.color = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
  });

  const answerEvents: AnswerEventPoint[] = participantSeries.flatMap((participant) =>
    participant.points
      .filter((point) => point.correctness !== null)
      .map((point) => ({
        participantKey: participant.key,
        participantLabel: participant.label,
        color: participant.color,
        index: point.index,
        roundIndex: point.roundIndex,
        correctness: point.correctness ?? 0,
        durationSeconds: point.durationSeconds,
        pointsAwarded: point.pointsAwarded
      }))
  );

  const transitionCounter = new Map<string, FlowTransition>();
  participantSeries.forEach((participant) => {
    for (let index = 1; index < participant.points.length; index += 1) {
      const previous = participant.points[index - 1];
      const current = participant.points[index];
      const from = normalizeEventType(previous.eventType);
      const to = normalizeEventType(current.eventType);
      const key = `${from}→${to}`;
      const entry = transitionCounter.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        transitionCounter.set(key, { from, to, count: 1 });
      }
    }
  });
  const transitions = Array.from(transitionCounter.values())
    .sort((left, right) => right.count - left.count || left.from.localeCompare(right.from))
    .slice(0, 12);

  const rounds = Array.from(
    new Set(
      answerEvents
        .map((point) => point.roundIndex)
        .filter((round): round is number => typeof round === 'number' && Number.isFinite(round))
    )
  ).sort((left, right) => left - right);

  const streamParticipantKeys = participantSeries.slice(0, 6).map((participant) => participant.key);
  const streamValues = new Map<string, Map<number, number>>();
  answerEvents.forEach((point) => {
    if (point.roundIndex === null || !streamParticipantKeys.includes(point.participantKey)) return;
    const bucket = streamValues.get(point.participantKey) ?? new Map<number, number>();
    bucket.set(point.roundIndex, (bucket.get(point.roundIndex) ?? 0) + 1);
    streamValues.set(point.participantKey, bucket);
  });

  const streamBands: StreamBand[] = streamParticipantKeys
    .map((participantKey) => {
      const participant = participantSeries.find((item) => item.key === participantKey);
      if (!participant) return null;
      return {
        key: participant.key,
        label: participant.label,
        color: participant.color,
        points: [] as StreamBandPoint[]
      } satisfies StreamBand;
    })
    .filter((value): value is StreamBand => value !== null);

  rounds.forEach((round, index) => {
    const total = streamBands.reduce((sum, band) => sum + (streamValues.get(band.key)?.get(round) ?? 0), 0);
    let cursor = -total / 2;
    streamBands.forEach((band) => {
      const value = streamValues.get(band.key)?.get(round) ?? 0;
      const y0 = cursor;
      const y1 = cursor + value;
      cursor = y1;
      band.points.push({
        round,
        x: index,
        y0,
        y1,
        value
      });
    });
  });

  const durationValues = answerEvents
    .map((point) => point.durationSeconds)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0);
  const averageDurationSeconds = durationValues.length > 0 ? mean(durationValues) : null;
  const medianDurationSeconds = durationValues.length > 0 ? median(durationValues) : null;
  const minDurationSeconds = durationValues.length > 0 ? Math.min(...durationValues) : null;
  const maxDurationSeconds = durationValues.length > 0 ? Math.max(...durationValues) : null;
  const p90DurationSeconds = durationValues.length > 0 ? percentile(durationValues, 90) : null;

  const topParticipant = participantSeries[0];
  const numberedStats: NumberedStatistic[] = [
    { label: 'Recorded events', value: formatCount(response.totalEvents) },
    { label: 'Checked answers', value: formatCount(response.totalAnswers) },
    {
      label: 'Correct answers',
      value: `${formatCount(response.totalCorrectAnswers)} (${formatFloat(response.averageCorrectness, 1)}%)`
    },
    { label: 'Participants', value: formatCount(participantSeries.length) },
    { label: 'Rounds observed', value: formatCount(rounds.length) },
    { label: 'Total points', value: formatCount(response.totalPoints) },
    {
      label: 'Top participant',
      value: topParticipant ? `${topParticipant.label} (${formatCount(topParticipant.totalPoints)} pts)` : 'n/a'
    },
    {
      label: 'Average response time',
      value: averageDurationSeconds === null ? 'n/a' : `${formatFloat(averageDurationSeconds, 2)} s`
    },
    {
      label: 'Median response time',
      value: medianDurationSeconds === null ? 'n/a' : `${formatFloat(medianDurationSeconds, 2)} s`
    },
    {
      label: 'Response time range',
      value:
        minDurationSeconds === null || maxDurationSeconds === null
          ? 'n/a'
          : `${formatFloat(minDurationSeconds, 2)} s - ${formatFloat(maxDurationSeconds, 2)} s`
    },
    {
      label: 'P90 response time',
      value: p90DurationSeconds === null ? 'n/a' : `${formatFloat(p90DurationSeconds, 2)} s`
    },
    {
      label: 'Observed transitions',
      value: formatCount(transitions.reduce((sum, transition) => sum + transition.count, 0))
    }
  ];
  const bestKnownWords = normalizeKnownessWords(response.bestKnownWords).slice(0, 12);
  const worstKnownWords = normalizeKnownessWords(response.worstKnownWords).slice(0, 12);

  return {
    response,
    timeline,
    participantSeries,
    answerEvents,
    transitions,
    rounds,
    streamBands,
    numberedStats,
    averageDurationSeconds,
    medianDurationSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    bestKnownWords,
    worstKnownWords
  };
}

function getParticipantsInRenderOrder(participants: ParticipantSeries[], focusedParticipantKey: string | null) {
  return participants;
}

function getStreamBandsInRenderOrder(bands: StreamBand[], focusedParticipantKey: string | null) {
  return bands;
}

function sortParticipantsForTimePyramid(
  participants: ParticipantSeries[],
  mode: 'total' | 'average',
  sortKey: 'name' | 'total' | 'left' | 'right',
  sortDirection: 'asc' | 'desc'
) {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const withValues = participants.map((participant) => {
    const leftValue = mode === 'total'
      ? toSafeNonNegative(participant.totalWrongDurationSeconds)
      : toSafeNonNegative(participant.averageWrongDurationSeconds);
    const rightValue = mode === 'total'
      ? toSafeNonNegative(participant.totalCorrectDurationSeconds)
      : toSafeNonNegative(participant.averageCorrectDurationSeconds);
    const totalValue = leftValue + rightValue;
    return { participant, leftValue, rightValue, totalValue };
  });

  withValues.sort((left, right) => {
    let compare = 0;
    switch (sortKey) {
      case 'left':
        compare = left.leftValue - right.leftValue;
        break;
      case 'right':
        compare = left.rightValue - right.rightValue;
        break;
      case 'total':
        compare = left.totalValue - right.totalValue;
        break;
      case 'name':
      default:
        compare = left.participant.label.localeCompare(right.participant.label);
        break;
    }
    if (compare === 0) {
      compare = left.participant.label.localeCompare(right.participant.label);
    }
    return compare * direction;
  });

  return withValues.map((entry) => entry.participant);
}

function renderLineChartModule(
  context: StatisticsContext,
  controls: StatisticsRenderControls,
  metric: 'knowness' | 'runningPoints',
  yLabel: string
) {
  const chartWidth = 940;
  const chartHeight = 240;
  const paddingX = 44;
  const paddingY = 20;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const source = getParticipantsInRenderOrder(
    context.participantSeries.filter((participant) => participant.points.length > 0),
    controls.focusedParticipantKey
  );
  const maxAnswersForKnownessSpread = Math.max(
    1,
    ...source.map((participant) =>
      Math.max(
        participant.answerCount,
        participant.points.length > 0 ? participant.points[participant.points.length - 1].answersSeen : 0
      )
    )
  );
  const normalizeKnownessForDisplay = (rawKnowness: number, answersSeen: number) => {
    if (metric !== 'knowness') return rawKnowness;
    if (answersSeen <= 0) return 50;
    const spread = Math.max(0.1, Math.min(1, answersSeen / maxAnswersForKnownessSpread));
    return 50 + (rawKnowness - 50) * spread;
  };
  const chartSeries = source.map((participant) => {
    const answerPoints = participant.points.filter((point) => point.correctness !== null);
    const basePoints = answerPoints.length > 0 ? answerPoints : participant.points;
    return {
      participant,
      points: basePoints.map((point, answerIndex) => ({
        x: answerIndex + 1,
        y:
          metric === 'knowness'
            ? normalizeKnownessForDisplay(point.knowness, point.answersSeen)
            : point.runningPoints
      }))
    };
  });
  const xValues = chartSeries.flatMap((series) => series.points.map((point) => point.x));
  const minX = xValues.length > 0 ? Math.min(...xValues) : 0;
  const maxX = xValues.length > 0 ? Math.max(...xValues) : 1;
  const yValues = chartSeries.flatMap((series) => series.points.map((point) => point.y));
  const minY = yValues.length > 0 ? Math.min(...yValues) : 0;
  const maxY = yValues.length > 0 ? Math.max(...yValues) : 1;
  const safeMinY =
    metric === 'knowness'
      ? (() => {
          if (yValues.length === 0) return 0;
          const span = Math.max(2, maxY - minY);
          const padding = Math.max(2, span * 0.08);
          return Math.max(0, minY - padding);
        })()
      : Math.abs(maxY - minY) < 0.001
        ? minY - 1
        : minY;
  const safeMaxY =
    metric === 'knowness'
      ? (() => {
          if (yValues.length === 0) return 100;
          const span = Math.max(2, maxY - minY);
          const padding = Math.max(2, span * 0.08);
          return Math.min(100, maxY + padding);
        })()
      : Math.abs(maxY - minY) < 0.001
        ? maxY + 1
        : maxY;

  const toX = (value: number) => {
    if (Math.abs(maxX - minX) < 0.001) return paddingX + plotWidth / 2;
    return paddingX + ((value - minX) / (maxX - minX)) * plotWidth;
  };
  const toY = (value: number) => {
    if (Math.abs(safeMaxY - safeMinY) < 0.001) return paddingY + plotHeight / 2;
    const normalized = (value - safeMinY) / (safeMaxY - safeMinY);
    return paddingY + (1 - normalized) * plotHeight;
  };

  const yTicks = metric === 'knowness' ? 8 : 5;
  const xTickValues = (() => {
    if (maxX <= minX) return [minX];
    const span = maxX - minX;
    if (span <= 20) {
      return Array.from({ length: span + 1 }, (_, i) => minX + i);
    }
    const targetTicks = 9;
    const roughStep = Math.max(1, span / targetTicks);
    const normalized = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const candidates = [1, 2, 5, 10].map((base) => base * normalized);
    const step = candidates.find((candidate) => candidate >= roughStep) ?? candidates[candidates.length - 1];
    const values: number[] = [];
    let current = minX;
    while (current <= maxX) {
      values.push(current);
      current += step;
    }
    if (values[values.length - 1] !== maxX) values.push(maxX);
    return values;
  })();

  return (
    <div className="cogita-statistics-chart-card">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: yTicks + 1 }).map((_, index) => {
          const ratio = index / yTicks;
          const value = safeMaxY - (safeMaxY - safeMinY) * ratio;
          const y = paddingY + ratio * plotHeight;
          const yLinePath =
            metric === 'knowness'
              ? (() => {
                  const samples = 24;
                  const points = Array.from({ length: samples + 1 }, (_, sampleIndex) => {
                    const t = sampleIndex / samples;
                    const x = paddingX + t * plotWidth;
                    const spread = t;
                    const transformedValue = 50 + (value - 50) * spread;
                    return { x, y: toY(transformedValue) };
                  });
                  return buildLinePath(points);
                })()
              : '';
          return (
            <g key={`y-tick-${index}`}>
              {metric === 'knowness' ? (
                <path d={yLinePath} stroke="rgba(120, 170, 220, 0.18)" fill="none" />
              ) : (
                <>
                  <line x1={paddingX} y1={y} x2={paddingX + plotWidth} y2={y} stroke="rgba(120, 170, 220, 0.18)" />
                  <text x={6} y={y + 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                    {formatFloat(value, 0)}
                  </text>
                </>
              )}
              {metric === 'knowness' ? (
                <text x={paddingX + plotWidth + 8} y={toY(value) + 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                  {`${formatFloat(value, 1)}%`}
                </text>
              ) : null}
            </g>
          );
        })}
        {xTickValues.map((value, index) => {
          const ratio = maxX === minX ? 0 : (value - minX) / (maxX - minX);
          const x = paddingX + ratio * plotWidth;
          return (
            <g key={`x-tick-${value}-${index}`}>
              <line x1={x} y1={paddingY} x2={x} y2={paddingY + plotHeight} stroke="rgba(120, 170, 220, 0.12)" />
              <text x={x - 8} y={chartHeight - 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                {formatFloat(value, 0)}
              </text>
            </g>
          );
        })}
        {chartSeries.map(({ participant, points: seriesPoints }) => {
          const points = seriesPoints.map((point) => ({
            x: toX(point.x),
            y: toY(point.y)
          }));
          const line = buildLinePath(points);
          if (!line) return null;
          return (
            <g key={`line-${metric}-${participant.key}`}>
              <path
                d={line}
                stroke={participant.color}
                fill="none"
                strokeWidth={controls.focusedParticipantKey === participant.key ? 3.8 : 2.2}
                strokeLinecap="round"
                opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.26 : 0.95}
              />
              {points.map((point, index) => (
                <circle
                  key={`${participant.key}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={controls.focusedParticipantKey === participant.key ? 3 : 2.2}
                  fill={participant.color}
                  opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.32 : 0.98}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="cogita-help">{yLabel}</p>
    </div>
  );
}

const STATISTICS_MODULES: StatisticsModule[] = [
  {
    id: 'score-line',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.points.length > 0),
    render: (context, controls) =>
      renderLineChartModule(context, controls, 'runningPoints', 'Running points show cumulative score progression in this scope.')
  },
  {
    id: 'knowness-words',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.bestKnownWords.length > 0 || context.worstKnownWords.length > 0,
    render: (context) => (
      <div className="cogita-statistics-chart-card">
        <div className="cogita-statistics-word-lists">
          <section>
            <p className="cogita-user-kicker">Best known words</p>
            {context.bestKnownWords.length > 0 ? (
              <ol className="cogita-statistics-word-list">
                {context.bestKnownWords.map((item, index) => (
                  <li key={`best-${item.notionId}`} className="cogita-statistics-word-row">
                    <span className="cogita-statistics-word-rank">#{index + 1}</span>
                    <div className="cogita-statistics-word-content">
                      <strong title={item.label}>{item.label}</strong>
                      <p>{`Knowness ${formatFloat(item.knownessScore, 1)} · Correct ${formatFloat(item.averageCorrectness, 1)}% · ${formatCount(item.answerCount)} answers`}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cogita-help">No scored words available.</p>
            )}
          </section>
          <section>
            <p className="cogita-user-kicker">Worst known words</p>
            {context.worstKnownWords.length > 0 ? (
              <ol className="cogita-statistics-word-list">
                {context.worstKnownWords.map((item, index) => (
                  <li key={`worst-${item.notionId}`} className="cogita-statistics-word-row">
                    <span className="cogita-statistics-word-rank">#{index + 1}</span>
                    <div className="cogita-statistics-word-content">
                      <strong title={item.label}>{item.label}</strong>
                      <p>{`Knowness ${formatFloat(item.knownessScore, 1)} · Correct ${formatFloat(item.averageCorrectness, 1)}% · ${formatCount(item.answerCount)} answers`}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cogita-help">No scored words available.</p>
            )}
          </section>
        </div>
      </div>
    )
  },
  {
    id: 'knowness-line',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.points.length > 0),
    render: (context, controls) =>
      renderLineChartModule(context, controls, 'knowness', 'Knowness values are computed over time by the shared temporal algorithm.')
  },
  {
    id: 'round-score-line',
    title: '',
    subtitle: '',
    isAvailable: (context) =>
      context.rounds.length > 0 &&
      context.participantSeries.some((participant) =>
        participant.points.some((point) => point.roundIndex !== null && point.correctness !== null)
      ),
    render: (context, controls) => {
      const chartWidth = 940;
      const chartHeight = 240;
      const paddingX = 44;
      const paddingY = 20;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;

      const rounds = context.rounds.length > 0
        ? context.rounds
        : Array.from(
            new Set(
              context.participantSeries.flatMap((participant) =>
                participant.points
                  .map((point) => point.roundIndex)
                  .filter((round): round is number => typeof round === 'number' && Number.isFinite(round))
              )
            )
          ).sort((left, right) => left - right);

      const participants = getParticipantsInRenderOrder(
        context.participantSeries,
        controls.focusedParticipantKey
      );

      const series = participants.map((participant) => {
        const byRound = new Map<number, number>();
        participant.points.forEach((point) => {
          if (point.correctness === null || point.roundIndex === null) return;
          byRound.set(point.roundIndex, (byRound.get(point.roundIndex) ?? 0) + (Number.isFinite(point.pointsAwarded) ? point.pointsAwarded : 0));
        });
        return {
          participant,
          values: rounds.map((round) => ({
            round,
            value: byRound.get(round) ?? 0
          }))
        };
      });

      const yValues = series.flatMap((item) => item.values.map((point) => point.value));
      const minYRaw = yValues.length > 0 ? Math.min(...yValues) : 0;
      const maxYRaw = yValues.length > 0 ? Math.max(...yValues) : 0;
      const minY = Math.min(0, minYRaw);
      const maxY = Math.max(0, maxYRaw);
      const safeMinY = Math.abs(maxY - minY) < 0.001 ? minY - 1 : minY;
      const safeMaxY = Math.abs(maxY - minY) < 0.001 ? maxY + 1 : maxY;

      const toX = (roundIndex: number) => {
        if (rounds.length <= 1) return paddingX + plotWidth / 2;
        const start = rounds[0];
        const end = rounds[rounds.length - 1];
        const ratio = end === start ? 0 : (roundIndex - start) / (end - start);
        return paddingX + ratio * plotWidth;
      };
      const toY = (value: number) => {
        if (Math.abs(safeMaxY - safeMinY) < 0.001) return paddingY + plotHeight / 2;
        const normalized = (value - safeMinY) / (safeMaxY - safeMinY);
        return paddingY + (1 - normalized) * plotHeight;
      };

      const yTickCount = 6;
      const zeroY = toY(0);

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            {Array.from({ length: yTickCount + 1 }).map((_, index) => {
              const ratio = index / yTickCount;
              const value = safeMaxY - (safeMaxY - safeMinY) * ratio;
              const y = paddingY + ratio * plotHeight;
              return (
                <g key={`round-score-y-${index}`}>
                  <line x1={paddingX} y1={y} x2={paddingX + plotWidth} y2={y} stroke="rgba(120, 170, 220, 0.18)" />
                  <text x={6} y={y + 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                    {formatFloat(value, 0)}
                  </text>
                </g>
              );
            })}
            <line x1={paddingX} y1={zeroY} x2={paddingX + plotWidth} y2={zeroY} stroke="rgba(168, 214, 255, 0.36)" />
            {rounds.map((round, index) => {
              const x = toX(round);
              return (
                <g key={`round-score-x-${round}-${index}`}>
                  <line x1={x} y1={paddingY} x2={x} y2={paddingY + plotHeight} stroke="rgba(120, 170, 220, 0.12)" />
                  <text x={x - 8} y={chartHeight - 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                    {formatFloat(round, 0)}
                  </text>
                </g>
              );
            })}

            {series.map(({ participant, values }) => {
              const points = values.map((entry) => ({ x: toX(entry.round), y: toY(entry.value) }));
              const line = buildLinePath(points);
              if (!line) return null;
              return (
                <g key={`round-score-series-${participant.key}`}>
                  <path
                    d={line}
                    stroke={participant.color}
                    fill="none"
                    strokeWidth={controls.focusedParticipantKey === participant.key ? 3.8 : 2.2}
                    strokeLinecap="round"
                    opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.26 : 0.95}
                  />
                  {points.map((point, index) => (
                    <circle
                      key={`round-score-point-${participant.key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={controls.focusedParticipantKey === participant.key ? 3 : 2.2}
                      fill={participant.color}
                      opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.32 : 0.98}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <p className="cogita-help">Per-round score deltas (positive and negative) on a shared linear scale.</p>
        </div>
      );
    }
  },
  {
    id: 'response-time-participants',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.averageDurationSeconds !== null),
    render: (context, controls) => {
      const chartWidth = 940;
      const chartHeight = 260;
      const paddingX = 40;
      const paddingY = 24;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;

      const participants = getParticipantsInRenderOrder(
        context.participantSeries
          .filter((participant) => participant.averageDurationSeconds !== null)
          .sort((left, right) => (left.averageDurationSeconds ?? 0) - (right.averageDurationSeconds ?? 0)),
        controls.focusedParticipantKey
      );
      const maxValue = Math.max(1, ...participants.map((participant) => participant.averageDurationSeconds ?? 0));
      const columnWidth = participants.length > 0 ? plotWidth / participants.length : plotWidth;

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            <line
              x1={paddingX}
              y1={paddingY + plotHeight}
              x2={paddingX + plotWidth}
              y2={paddingY + plotHeight}
              stroke="rgba(120, 170, 220, 0.32)"
            />
            {participants.map((participant, index) => {
              const value = participant.averageDurationSeconds ?? 0;
              const ratio = value / maxValue;
              const barHeight = ratio * plotHeight;
              const x = paddingX + index * columnWidth + columnWidth * 0.15;
              const y = paddingY + plotHeight - barHeight;
              const width = columnWidth * 0.7;
              return (
                <g key={`duration-bar-${participant.key}`}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={barHeight}
                    rx={6}
                    fill={participant.color}
                    opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.28 : 0.86}
                  />
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="rgba(208, 229, 252, 0.92)" fontSize="10">
                    {formatFloat(value, 2)}s
                  </text>
                  <text
                    x={x + width / 2}
                    y={paddingY + plotHeight + 14}
                    textAnchor="middle"
                    fill="rgba(178, 204, 236, 0.82)"
                    fontSize="10"
                  >
                    {participant.label.length > 12 ? `${participant.label.slice(0, 12)}…` : participant.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="cogita-help">Lower bars mean faster average responses.</p>
        </div>
      );
    }
  },
  {
    id: 'response-time-pyramid',
    title: '',
    subtitle: '',
    isAvailable: (context) =>
      context.participantSeries.some(
        (participant) =>
          participant.totalCorrectDurationSeconds !== null || participant.totalWrongDurationSeconds !== null
      ),
    render: (context, controls) => {
      const ranked = getParticipantsInRenderOrder(
        sortParticipantsForTimePyramid(
          context.participantSeries,
          'total',
          controls.timePyramidSortKey,
          controls.timePyramidSortDirection
        ),
        controls.focusedParticipantKey
      );
      const maxSide = Math.max(
        1,
        ...ranked.map((participant) =>
          Math.max(
            0,
            participant.totalCorrectDurationSeconds ?? 0,
            participant.totalWrongDurationSeconds ?? 0
          )
        )
      );
      const totalDurationSeconds = ranked.reduce((sum, participant) => {
        const value = participant.totalDurationSeconds;
        return sum + (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
      }, 0);
      return (
        <div className="cogita-statistics-chart-card">
          <div className="cogita-statistics-table-grid cogita-statistics-table-grid--head">
            <span>#</span>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'name' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('name')}>{controls.labels.participant}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'total' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('total')}>{controls.labels.total}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'left' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('left')}>{controls.labels.left}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'right' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('right')}>{controls.labels.right}</button>
            <span>{controls.timePyramidSortDirection === 'asc' ? controls.labels.asc : controls.labels.desc}</span>
            <span />
            <span />
          </div>
          <p className="cogita-help">
            {totalDurationSeconds <= 0
              ? 'Overall response time: n/a'
              : `Overall response time: ${formatFloat(totalDurationSeconds, 2)} s`}
          </p>
          <div className="cogita-statistics-time-pyramid">
            {ranked.map((participant, index) => {
              const total = Math.max(0, participant.totalDurationSeconds ?? 0);
              const correct = Math.max(0, participant.totalCorrectDurationSeconds ?? 0);
              const wrong = Math.max(0, participant.totalWrongDurationSeconds ?? 0);
              const correctWidth = Math.max(0, Math.min(100, (correct / maxSide) * 100));
              const wrongWidth = Math.max(0, Math.min(100, (wrong / maxSide) * 100));
              return (
                <div
                  key={`time-pyramid-${participant.key}`}
                  className="cogita-statistics-time-pyramid-row"
                  style={{
                    opacity: controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.35 : 1
                  }}
                >
                  <span className="cogita-statistics-pyramid-rank">#{index + 1}</span>
                  <div className="cogita-statistics-time-pyramid-main">
                    <div className="cogita-statistics-time-pyramid-head">
                      <span>{participant.label}</span>
                      <strong>{`${formatFloat(total, 2)} s`}</strong>
                    </div>
                    <div className="cogita-statistics-time-pyramid-axis">
                      <div className="cogita-statistics-time-pyramid-half is-left">
                        <span
                          className="cogita-statistics-time-pyramid-fill is-wrong-time"
                          style={{ width: `${wrongWidth}%` }}
                          title={`Wrong total ${wrong > 0 ? formatFloat(wrong, 2) : 'n/a'} s`}
                        />
                      </div>
                      <span className="cogita-statistics-time-pyramid-center" />
                      <div className="cogita-statistics-time-pyramid-half is-right">
                        <span
                          className="cogita-statistics-time-pyramid-fill is-correct-time"
                          style={{ width: `${correctWidth}%` }}
                          title={`Correct total ${correct > 0 ? formatFloat(correct, 2) : 'n/a'} s`}
                        />
                      </div>
                    </div>
                    <div className="cogita-statistics-pyramid-details cogita-statistics-time-pyramid-details">
                      <small>{`Wrong total ${wrong > 0 ? formatFloat(wrong, 2) : 'n/a'} s`}</small>
                      <small>{`Correct total ${correct > 0 ? formatFloat(correct, 2) : 'n/a'} s`}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  },
  {
    id: 'response-time-split',
    title: '',
    subtitle: '',
    isAvailable: (context) =>
      context.participantSeries.some(
        (participant) =>
          participant.averageCorrectDurationSeconds !== null || participant.averageWrongDurationSeconds !== null
      ),
    render: (context, controls) => {
      const participants = getParticipantsInRenderOrder(
        sortParticipantsForTimePyramid(
          context.participantSeries,
          'average',
          controls.timePyramidSortKey,
          controls.timePyramidSortDirection
        ),
        controls.focusedParticipantKey
      );
      const durationValues = participants.flatMap((participant) => [
        toSafeNonNegative(participant.averageCorrectDurationSeconds),
        toSafeNonNegative(participant.averageWrongDurationSeconds)
      ]);
      const finiteDurations = durationValues.filter((value) => Number.isFinite(value) && value > 0);
      const maxValue = Math.max(1, finiteDurations.length > 0 ? Math.max(...finiteDurations) : 0);

      return (
        <div className="cogita-statistics-chart-card">
          <div className="cogita-statistics-table-grid cogita-statistics-table-grid--head">
            <span>#</span>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'name' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('name')}>{controls.labels.participant}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'total' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('total')}>{controls.labels.total}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'left' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('left')}>{controls.labels.left}</button>
            <button type="button" className={`cogita-statistics-sort ${controls.timePyramidSortKey === 'right' ? 'active' : ''}`} onClick={() => controls.setTimePyramidSort('right')}>{controls.labels.right}</button>
            <span>{controls.timePyramidSortDirection === 'asc' ? controls.labels.asc : controls.labels.desc}</span>
            <span />
            <span />
          </div>
          <div className="cogita-statistics-time-split">
            {participants.map((participant) => {
              const correct = toSafeNonNegative(participant.averageCorrectDurationSeconds);
              const wrong = toSafeNonNegative(participant.averageWrongDurationSeconds);
              const correctWidth = maxValue > 0 ? Math.max(0, Math.min(100, (correct / maxValue) * 100)) : 0;
              const wrongWidth = maxValue > 0 ? Math.max(0, Math.min(100, (wrong / maxValue) * 100)) : 0;
              return (
                <div
                  key={`time-split-${participant.key}`}
                  className="cogita-statistics-time-split-row"
                  style={{
                    opacity:
                      controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.34 : 1
                  }}
                >
                  <div className="cogita-statistics-time-split-head">
                    <strong title={participant.label}>{participant.label}</strong>
                  </div>
                  <div className="cogita-statistics-time-split-axis">
                    <div className="cogita-statistics-time-pyramid-half is-left">
                      <div className="cogita-statistics-time-split-track is-left">
                        <div
                          className="cogita-statistics-time-split-fill is-wrong-time"
                          style={{ width: `${wrongWidth}%` }}
                        />
                        <small>{wrong > 0 ? `${formatFloat(wrong, 2)} s` : 'n/a'}</small>
                      </div>
                    </div>
                    <span className="cogita-statistics-time-pyramid-center" />
                    <div className="cogita-statistics-time-pyramid-half is-right">
                      <div className="cogita-statistics-time-split-track is-right">
                        <div
                          className="cogita-statistics-time-split-fill is-correct-time"
                          style={{ width: `${correctWidth}%` }}
                        />
                        <small>{correct > 0 ? `${formatFloat(correct, 2)} s` : 'n/a'}</small>
                      </div>
                    </div>
                  </div>
                  <div className="cogita-statistics-time-split-details">
                    <small>{`Wrong ${wrong > 0 ? formatFloat(wrong, 2) : 'n/a'} s`}</small>
                    <small>{`Correct ${correct > 0 ? formatFloat(correct, 2) : 'n/a'} s`}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  },
  {
    id: 'participant-bars',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.participantSeries.length > 0,
    render: (context, controls) => {
      const chartWidth = 940;
      const chartHeight = 260;
      const paddingX = 40;
      const paddingY = 24;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;
      // Keep visual order stable (score/rank order). Focus should not move bars.
      const participants = context.participantSeries;
      const maxValue = Math.max(1, ...participants.map((participant) => participant.totalPoints));
      const columnWidth = participants.length > 0 ? plotWidth / participants.length : plotWidth;

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            <line
              x1={paddingX}
              y1={paddingY + plotHeight}
              x2={paddingX + plotWidth}
              y2={paddingY + plotHeight}
              stroke="rgba(120, 170, 220, 0.32)"
            />
            {participants.map((participant, index) => {
              const ratio = participant.totalPoints / maxValue;
              const barHeight = ratio * plotHeight;
              const x = paddingX + index * columnWidth + columnWidth * 0.15;
              const y = paddingY + plotHeight - barHeight;
              const width = columnWidth * 0.7;
              return (
                <g key={`bar-${participant.key}`}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={barHeight}
                    rx={6}
                    fill={participant.color}
                    opacity={controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.28 : 0.86}
                  />
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="rgba(208, 229, 252, 0.92)" fontSize="10">
                    {formatCount(participant.totalPoints)}
                  </text>
                  <text
                    x={x + width / 2}
                    y={paddingY + plotHeight + 14}
                    textAnchor="middle"
                    fill="rgba(178, 204, 236, 0.82)"
                    fontSize="10"
                  >
                    {participant.label.length > 12 ? `${participant.label.slice(0, 12)}…` : participant.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      );
    }
  },
  {
    id: 'pyramid',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.correctCount > 0),
    render: (context, controls) => {
      const ranked = getParticipantsInRenderOrder(
        context.participantSeries
          .filter((participant) => participant.correctCount > 0)
          .sort(
            (left, right) =>
              right.averagePointsPerCorrectAnswer - left.averagePointsPerCorrectAnswer ||
              left.label.localeCompare(right.label)
          ),
        controls.focusedParticipantKey
      );
      const max = Math.max(1, ...ranked.map((participant) => participant.averagePointsPerCorrectAnswer));
      return (
        <div className="cogita-statistics-chart-card">
          <div className="cogita-statistics-pyramid">
            {ranked.map((participant, index) => {
              const total = Math.max(0, participant.averagePointsPerCorrectAnswer);
              let base = Math.max(0, participant.averageBasePointsPerCorrectAnswer);
              let first = Math.max(0, participant.averageFirstBonusPointsPerCorrectAnswer);
              let speed = Math.max(0, participant.averageSpeedBonusPointsPerCorrectAnswer);
              let streak = Math.max(0, participant.averageStreakBonusPointsPerCorrectAnswer);
              if (base + first + speed + streak <= 0 && total > 0) {
                base = total;
                first = 0;
                speed = 0;
                streak = 0;
              }
              const baseWidth = Math.max(0, Math.min(100, (base / max) * 100));
              const firstWidth = Math.max(0, Math.min(100, (first / max) * 100));
              const speedWidth = Math.max(0, Math.min(100, (speed / max) * 100));
              const streakWidth = Math.max(0, Math.min(100, (streak / max) * 100));
              return (
                <div key={`pyramid-${participant.key}`} className="cogita-statistics-pyramid-row">
                  <span className="cogita-statistics-pyramid-rank">#{index + 1}</span>
                  <div className="cogita-statistics-pyramid-bar-wrap">
                    <div
                      className="cogita-statistics-pyramid-bar"
                      style={{
                        width: '100%',
                        background: 'rgba(10, 28, 50, 0.45)',
                        opacity: controls.focusedParticipantKey && controls.focusedParticipantKey !== participant.key ? 0.35 : 1
                      }}
                    >
                      <div className="cogita-statistics-pyramid-segments">
                        <span className="cogita-statistics-pyramid-segment is-base" style={{ width: `${baseWidth}%` }} />
                        <span className="cogita-statistics-pyramid-segment is-first" style={{ width: `${firstWidth}%` }} />
                        <span className="cogita-statistics-pyramid-segment is-speed" style={{ width: `${speedWidth}%` }} />
                        <span className="cogita-statistics-pyramid-segment is-streak" style={{ width: `${streakWidth}%` }} />
                      </div>
                      <span>{participant.label}</span>
                      <strong>{`${formatFloat(total, 1)} pts/correct`}</strong>
                    </div>
                    <div className="cogita-statistics-pyramid-details">
                      <small>{`Base ${formatFloat(base, 1)}`}</small>
                      <small>{`First ${formatFloat(first, 1)}`}</small>
                      <small>{`Speed ${formatFloat(speed, 1)}`}</small>
                      <small>{`Streak ${formatFloat(streak, 1)}`}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  },
  {
    id: 'metrics',
    title: '',
    subtitle: '',
    isAvailable: (context) => context.numberedStats.length > 0,
    render: (context) => (
      <div className="cogita-statistics-chart-card">
        <ol className="cogita-statistics-numbered-list">
          {context.numberedStats.map((statistic, index) => (
            <li key={`${statistic.label}-${index}`} className="cogita-statistics-numbered-item">
              <span className="cogita-statistics-number">{index + 1}</span>
              <div>
                <strong>{statistic.label}</strong>
                <p>{statistic.value}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    )
  }
];

function resolveStatisticsModuleTitle(ui: ReturnType<typeof getStatisticsUiText>, moduleId: string, fallback: string) {
  switch (moduleId) {
    case 'score-line':
      return ui.modules.scoreLineTitle;
    case 'knowness-words':
      return ui.modules.knownessWordsTitle;
    case 'knowness-line':
      return ui.modules.knownessLineTitle;
    case 'round-score-line':
      return ui.modules.roundScoreGainTitle;
    case 'response-time-participants':
      return ui.modules.responseTimeComparisonTitle;
    case 'response-time-pyramid':
      return ui.modules.responseTimePyramidTitle;
    case 'response-time-split':
      return ui.modules.responseTimeSplitTitle;
    case 'participant-bars':
      return ui.modules.barChartTitle;
    case 'pyramid':
      return ui.modules.pyramidRankingTitle;
    case 'metrics':
      return ui.modules.numberedMetricsTitle;
    default:
      return fallback;
  }
}

function resolveStatisticsModuleSubtitle(ui: ReturnType<typeof getStatisticsUiText>, moduleId: string, fallback: string) {
  switch (moduleId) {
    case 'score-line':
      return ui.modules.scoreLineSubtitle;
    case 'knowness-words':
      return ui.modules.knownessWordsSubtitle;
    case 'knowness-line':
      return ui.modules.knownessLineSubtitle;
    case 'round-score-line':
      return ui.modules.roundScoreGainSubtitle;
    case 'response-time-participants':
      return ui.modules.responseTimeComparisonSubtitle;
    case 'response-time-pyramid':
      return ui.modules.responseTimePyramidSubtitle;
    case 'response-time-split':
      return ui.modules.responseTimeSplitSubtitle;
    case 'participant-bars':
      return ui.modules.barChartSubtitle;
    case 'pyramid':
      return ui.modules.pyramidRankingSubtitle;
    case 'metrics':
      return ui.modules.numberedMetricsSubtitle;
    default:
      return fallback;
  }
}

export function CogitaStatisticsPanel({
  libraryId,
  scopeType,
  scopeId,
  selectedPersonRoleId,
  persistentOnly = false,
  title = 'Statistics',
  initialModuleId,
  data,
  loading,
  error
}: {
  libraryId: string;
  scopeType: 'library' | 'info' | 'connection' | 'collection' | 'revision' | 'live-session';
  scopeId?: string | null;
  selectedPersonRoleId?: string | null;
  persistentOnly?: boolean;
  title?: string;
  initialModuleId?: string;
  data?: CogitaStatisticsResponse | null;
  loading?: boolean;
  error?: boolean;
}) {
  type ScoreboardSortKey = 'score' | 'correctness' | 'totalTime' | 'avgTime' | 'answers' | 'name';
  type ScoreboardSortDirection = 'asc' | 'desc';

  const [state, setState] = useState<CogitaStatisticsResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slideIndex, setSlideIndex] = useState(0);
  const [scoreboardSortKey, setScoreboardSortKey] = useState<ScoreboardSortKey>('score');
  const [scoreboardSortDirection, setScoreboardSortDirection] = useState<ScoreboardSortDirection>('desc');
  const [timePyramidSortKey, setTimePyramidSortKey] = useState<'name' | 'total' | 'left' | 'right'>('total');
  const [timePyramidSortDirection, setTimePyramidSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleParticipantKeys, setVisibleParticipantKeys] = useState<Set<string>>(new Set());
  const [hoveredParticipantKey, setHoveredParticipantKey] = useState<string | null>(null);
  const [pinnedParticipantKey, setPinnedParticipantKey] = useState<string | null>(null);
  const appliedInitialModuleRef = useRef<string | null>(null);
  const ui = useMemo(() => getStatisticsUiText(), []);
  const usesExternalData = data !== undefined;

  const resolvedStatus: 'loading' | 'ready' | 'error' = usesExternalData
    ? loading
      ? 'loading'
      : error
      ? 'error'
      : 'ready'
    : status;

  const resolvedState = usesExternalData ? data ?? null : state;

  useEffect(() => {
    if (usesExternalData) return;
    let cancelled = false;
    setStatus('loading');
    getCogitaStatistics({
      libraryId,
      scopeType,
      scopeId: scopeId ?? null,
      personRoleId: selectedPersonRoleId ?? null,
      persistentOnly,
      limit: 3000
    })
      .then((response) => {
        if (cancelled) return;
        setState(response);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setState(null);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, scopeId, scopeType, selectedPersonRoleId, persistentOnly, usesExternalData]);

  const statisticsContext = useMemo(() => {
    if (!resolvedState) return null;
    return makeStatisticsContext(resolvedState);
  }, [resolvedState]);

  useEffect(() => {
    if (!statisticsContext) {
      setVisibleParticipantKeys(new Set());
      setHoveredParticipantKey(null);
      setPinnedParticipantKey(null);
      return;
    }
    const allKeys = statisticsContext.participantSeries.map((participant) => participant.key);
    setVisibleParticipantKeys((current) => {
      if (current.size === 0) return new Set(allKeys);
      const next = new Set(allKeys.filter((key) => current.has(key)));
      if (next.size === 0) return new Set(allKeys);
      return next;
    });
    setHoveredParticipantKey((current) => (current && allKeys.includes(current) ? current : null));
    setPinnedParticipantKey((current) => (current && allKeys.includes(current) ? current : null));
  }, [statisticsContext]);

  const filteredStatisticsContext = useMemo(() => {
    if (!statisticsContext) return null;
    const visibleKeys = visibleParticipantKeys.size > 0 ? visibleParticipantKeys : new Set(statisticsContext.participantSeries.map((p) => p.key));
    const filteredParticipantSeries = statisticsContext.participantSeries.filter((participant) => visibleKeys.has(participant.key));
    const filteredAnswerEvents = statisticsContext.answerEvents.filter((event) => visibleKeys.has(event.participantKey));
    const filteredStreamBands = statisticsContext.streamBands.filter((band) => visibleKeys.has(band.key));
    return {
      ...statisticsContext,
      participantSeries: filteredParticipantSeries,
      answerEvents: filteredAnswerEvents,
      streamBands: filteredStreamBands
    } satisfies StatisticsContext;
  }, [statisticsContext, visibleParticipantKeys]);

  const focusedParticipantKey = hoveredParticipantKey ?? pinnedParticipantKey;
  const scoreRankByParticipant = useMemo(() => {
    if (!statisticsContext) return new Map<string, number>();
    return new Map(statisticsContext.participantSeries.map((participant, index) => [participant.key, index + 1]));
  }, [statisticsContext]);
  const scoreboardRows = useMemo(() => {
    if (!statisticsContext) return [] as ParticipantSeries[];
    const rows = [...statisticsContext.participantSeries];
    const directionFactor = scoreboardSortDirection === 'asc' ? 1 : -1;
    rows.sort((left, right) => {
      let compare = 0;
      switch (scoreboardSortKey) {
        case 'name':
          compare = left.label.localeCompare(right.label);
          break;
        case 'correctness':
          compare = left.averageCorrectness - right.averageCorrectness;
          break;
        case 'totalTime':
          compare = (left.totalDurationSeconds ?? Number.POSITIVE_INFINITY) - (right.totalDurationSeconds ?? Number.POSITIVE_INFINITY);
          break;
        case 'avgTime':
          compare = (left.averageDurationSeconds ?? Number.POSITIVE_INFINITY) - (right.averageDurationSeconds ?? Number.POSITIVE_INFINITY);
          break;
        case 'answers':
          compare = left.answerCount - right.answerCount;
          break;
        case 'score':
        default:
          compare = left.totalPoints - right.totalPoints;
          break;
      }
      if (compare === 0) {
        compare = left.label.localeCompare(right.label);
      }
      return compare * directionFactor;
    });
    return rows;
  }, [statisticsContext, scoreboardSortDirection, scoreboardSortKey]);
  const setScoreboardSort = (nextKey: ScoreboardSortKey) => {
    if (scoreboardSortKey === nextKey) {
      setScoreboardSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setScoreboardSortKey(nextKey);
    setScoreboardSortDirection(nextKey === 'name' || nextKey === 'totalTime' || nextKey === 'avgTime' ? 'asc' : 'desc');
  };
  const scoreSortLabel = scoreboardSortDirection === 'asc' ? ui.ascending : ui.descending;
  const setTimePyramidSort = (key: 'name' | 'total' | 'left' | 'right') => {
    if (timePyramidSortKey === key) {
      setTimePyramidSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setTimePyramidSortKey(key);
    setTimePyramidSortDirection(key === 'name' ? 'asc' : 'desc');
  };

  const modules = useMemo(() => {
    if (!filteredStatisticsContext) return [] as StatisticsModule[];
    return STATISTICS_MODULES.filter((module) => module.isAvailable(filteredStatisticsContext));
  }, [filteredStatisticsContext]);

  useEffect(() => {
    if (modules.length === 0) {
      setSlideIndex(0);
      appliedInitialModuleRef.current = null;
      return;
    }
    setSlideIndex((current) => clamp(current, 0, modules.length - 1));
  }, [modules.length]);

  useEffect(() => {
    if (!initialModuleId || modules.length === 0) return;
    if (appliedInitialModuleRef.current === initialModuleId) return;
    const index = modules.findIndex((module) => module.id === initialModuleId);
    if (index >= 0) {
      setSlideIndex(index);
      appliedInitialModuleRef.current = initialModuleId;
    }
  }, [initialModuleId, modules]);

  const currentModule = modules[slideIndex] ?? null;
  const currentModuleTitle = currentModule
    ? resolveStatisticsModuleTitle(ui, currentModule.id, currentModule.title)
    : null;
  const currentModuleSubtitle = currentModule
    ? resolveStatisticsModuleSubtitle(ui, currentModule.id, currentModule.subtitle)
    : null;
  const hasMultipleSlides = modules.length > 1;

  return (
    <section className="cogita-library-panel cogita-statistics-panel">
      <div className="cogita-detail-header">
        <div>
          <p className="cogita-user-kicker">{title}</p>
          <h3 className="cogita-detail-title">
            {resolvedStatus === 'loading'
              ? ui.loading
              : resolvedStatus === 'error'
              ? ui.unavailable
              : interpolate(ui.checkedAnswers, { count: resolvedState?.totalAnswers ?? 0 })}
          </h3>
        </div>
      </div>

      {resolvedStatus === 'ready' && resolvedState && statisticsContext && filteredStatisticsContext ? (
        <>
          <div className="cogita-statistics-summary">
            <div className="cogita-statistics-chip">
              <strong>{formatFloat(resolvedState.averageCorrectness, 1)}%</strong>
              <span>{ui.avgCorrectness}</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>{formatCount(resolvedState.totalPoints)}</strong>
              <span>{ui.totalPoints}</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>{formatCount(filteredStatisticsContext.participantSeries.length)}</strong>
              <span>{ui.participants}</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>
                {statisticsContext.averageDurationSeconds === null
                  ? ui.notAvailable
                  : `${formatFloat(statisticsContext.averageDurationSeconds, 2)} s`}
              </strong>
              <span>{ui.avgResponseTime}</span>
            </div>
          </div>

          {currentModule ? (
            <div className="cogita-statistics-carousel">
              <div className="cogita-statistics-carousel-header">
                <div>
                  <p className="cogita-user-kicker">{currentModuleTitle}</p>
                  <p className="cogita-help">{currentModuleSubtitle}</p>
                </div>
                {hasMultipleSlides ? (
                  <div className="cogita-statistics-carousel-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSlideIndex((current) => (current <= 0 ? modules.length - 1 : current - 1))}
                    >
                      {ui.previous}
                    </button>
                    <span className="cogita-statistics-slide-count">
                      {slideIndex + 1} / {modules.length}
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSlideIndex((current) => (current + 1) % modules.length)}
                    >
                      {ui.next}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="cogita-statistics-carousel-window">
                <article className="cogita-statistics-slide">
                  {currentModule.render(filteredStatisticsContext, {
                    allParticipantSeries: statisticsContext.participantSeries,
                    visibleParticipantKeys:
                      visibleParticipantKeys.size > 0
                        ? visibleParticipantKeys
                        : new Set(statisticsContext.participantSeries.map((participant) => participant.key)),
                    focusedParticipantKey,
                    onToggleParticipantVisibility: (participantKey) => {
                      setVisibleParticipantKeys((current) => {
                        const allKeys = statisticsContext.participantSeries.map((participant) => participant.key);
                        const base = current.size > 0 ? new Set(current) : new Set(allKeys);
                        if (base.has(participantKey)) {
                          base.delete(participantKey);
                        } else {
                          base.add(participantKey);
                        }
                        return base.size === 0 ? new Set(allKeys) : base;
                      });
                    },
                    onHoverParticipant: (participantKey) => setHoveredParticipantKey(participantKey),
                    onToggleParticipantFocus: (participantKey) =>
                      setPinnedParticipantKey((current) => (current === participantKey ? null : participantKey)),
                    timePyramidSortKey,
                    timePyramidSortDirection,
                    setTimePyramidSort,
                    labels: {
                      participant: ui.participant,
                      total: ui.total,
                      left: ui.wrong,
                      right: ui.correct,
                      asc: ui.ascending,
                      desc: ui.descending
                    }
                  })}
                </article>
              </div>

              {hasMultipleSlides ? (
                <div className="cogita-statistics-carousel-dots">
                  {modules.map((module, index) => (
                    <button
                      key={module.id}
                      type="button"
                      className={`cogita-statistics-dot ${index === slideIndex ? 'active' : ''}`}
                      onClick={() => setSlideIndex(index)}
                      aria-label={interpolate(ui.openSlide, { index: index + 1 })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="cogita-library-hint">{ui.noStatsForScope}</p>
          )}

          {statisticsContext.participantSeries.length > 0 ? (
            <section className="cogita-statistics-table-panel">
              <div className="cogita-statistics-table-header">
                <p className="cogita-user-kicker">{ui.participantsTable}</p>
                <p className="cogita-help">{ui.participantsTableHint}</p>
              </div>
              <div className="cogita-statistics-table-grid cogita-statistics-table-grid--head">
                <span>#</span>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'name' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('name')}
                >
                  {ui.participant} {scoreboardSortKey === 'name' ? `(${scoreSortLabel})` : ''}
                </button>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'score' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('score')}
                >
                  {ui.score} {scoreboardSortKey === 'score' ? `(${scoreSortLabel})` : ''}
                </button>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'correctness' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('correctness')}
                >
                  {ui.correctness} {scoreboardSortKey === 'correctness' ? `(${scoreSortLabel})` : ''}
                </button>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'totalTime' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('totalTime')}
                >
                  {ui.totalTime} {scoreboardSortKey === 'totalTime' ? `(${scoreSortLabel})` : ''}
                </button>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'avgTime' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('avgTime')}
                >
                  {ui.avgTime} {scoreboardSortKey === 'avgTime' ? `(${scoreSortLabel})` : ''}
                </button>
                <button
                  type="button"
                  className={`cogita-statistics-sort ${scoreboardSortKey === 'answers' ? 'active' : ''}`}
                  onClick={() => setScoreboardSort('answers')}
                >
                  {ui.answers} {scoreboardSortKey === 'answers' ? `(${scoreSortLabel})` : ''}
                </button>
              </div>
              <div className="cogita-statistics-table-body">
                {scoreboardRows.map((participant) => {
                  const rank = scoreRankByParticipant.get(participant.key) ?? 0;
                  const isVisible =
                    visibleParticipantKeys.size > 0
                      ? visibleParticipantKeys.has(participant.key)
                      : true;
                  const isFocused = focusedParticipantKey === participant.key;
                  return (
                    <button
                      key={`row-${participant.key}`}
                      type="button"
                      className={`cogita-statistics-table-grid ${isFocused ? 'is-focused' : ''} ${isVisible ? '' : 'is-hidden'}`}
                      onMouseEnter={() => setHoveredParticipantKey(participant.key)}
                      onMouseLeave={() => setHoveredParticipantKey(null)}
                      onClick={() =>
                        setPinnedParticipantKey((current) => (current === participant.key ? null : participant.key))
                      }
                    >
                      <span className="cogita-statistics-rank-cell">{rank > 0 ? `#${rank}` : '-'}</span>
                      <span className="cogita-statistics-name-cell">
                        <button
                          type="button"
                          className="cogita-statistics-table-dot-toggle"
                          aria-label={interpolate(
                            isVisible ? ui.hideParticipant : ui.showParticipant,
                            { name: participant.label }
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            setVisibleParticipantKeys((current) => {
                              const allKeys = statisticsContext.participantSeries.map((p) => p.key);
                              const next = current.size > 0 ? new Set(current) : new Set(allKeys);
                              if (next.has(participant.key)) {
                                next.delete(participant.key);
                              } else {
                                next.add(participant.key);
                              }
                              return next.size === 0 ? new Set(allKeys) : next;
                            });
                          }}
                        >
                          <i
                            className="cogita-statistics-table-dot"
                            style={{
                              background: isVisible ? participant.color : 'transparent',
                              border: `2px solid ${participant.color}`,
                              boxShadow: isVisible ? `0 0 14px ${participant.color}` : 'none'
                            }}
                          />
                        </button>
                        <strong title={participant.label}>{participant.label}</strong>
                      </span>
                      <span>{formatCount(participant.totalPoints)}</span>
                      <span>{`${formatFloat(participant.averageCorrectness, 1)}%`}</span>
                      <span>{formatDuration(participant.totalDurationSeconds)}</span>
                      <span>{formatDuration(participant.averageDurationSeconds)}</span>
                      <span>{formatCount(participant.answerCount)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : resolvedStatus === 'error' ? (
        <p className="cogita-library-hint">{ui.loadFailed}</p>
      ) : null}
    </section>
  );
}
