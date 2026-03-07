import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCogitaStatistics, type CogitaStatisticsResponse, type CogitaStatisticsTimelinePoint } from '../../../../lib/api';

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
  eventType: string;
  roundIndex: number | null;
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
  averageCorrectness: number;
  answerCount: number;
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
  render: (context: StatisticsContext) => ReactNode;
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

function normalizeKnownessWords(source: CogitaStatisticsResponse['bestKnownWords'] | CogitaStatisticsResponse['worstKnownWords']) {
  return (source ?? [])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      infoId: String(item.infoId ?? ''),
      infoType: String(item.infoType ?? ''),
      label: String(item.label ?? '').trim() || String(item.infoType ?? 'word'),
      answerCount: Number.isFinite(item.answerCount) ? Math.max(0, Number(item.answerCount)) : 0,
      correctCount: Number.isFinite(item.correctCount) ? Math.max(0, Number(item.correctCount)) : 0,
      averageCorrectness: Number.isFinite(item.averageCorrectness) ? clamp(Number(item.averageCorrectness), 0, 100) : 0,
      knownessScore: Number.isFinite(item.knownessScore) ? clamp(Number(item.knownessScore), 0, 100) : 0
    }))
    .filter((item) => item.infoId.length > 0);
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
      const points = entries.map((point, sequence) => {
        let correctness: number | null = null;
        if (typeof point.correctness === 'number' && Number.isFinite(point.correctness)) {
          correctness = clamp(point.correctness, 0, 1);
        } else if (typeof point.isCorrect === 'boolean') {
          correctness = point.isCorrect ? 1 : 0;
        }
        const durationSeconds =
          typeof point.durationMs === 'number' && Number.isFinite(point.durationMs) && point.durationMs > 0
            ? point.durationMs / 1000
            : null;
        const pointsAwarded = typeof point.pointsAwarded === 'number' && Number.isFinite(point.pointsAwarded) ? point.pointsAwarded : 0;
        return {
          sequence,
          index: point.index ?? sequence + 1,
          eventType: point.eventType ?? 'event',
          roundIndex: typeof point.roundIndex === 'number' ? point.roundIndex : null,
          knowness: typeof point.knownessScore === 'number' && Number.isFinite(point.knownessScore) ? point.knownessScore : 0,
          runningPoints: typeof point.runningPoints === 'number' && Number.isFinite(point.runningPoints) ? point.runningPoints : 0,
          correctness,
          durationSeconds,
          pointsAwarded
        } satisfies ParticipantSeriesPoint;
      });
      return {
        key: participantKey,
        label: summary?.label ?? labelByParticipant.get(participantKey) ?? participantKey,
        color: colorByParticipant.get(participantKey) ?? PARTICIPANT_COLORS[0],
        totalPoints: summary?.totalPoints ?? (points.length > 0 ? points[points.length - 1].runningPoints : 0),
        averageCorrectness: summary?.averageCorrectness ?? 0,
        answerCount: summary?.answerCount ?? points.filter((point) => point.correctness !== null).length,
        points
      } satisfies ParticipantSeries;
    })
    .filter((participant) => participant.points.length > 0 || participant.answerCount > 0);

  participantSeries.sort((left, right) => right.totalPoints - left.totalPoints || left.label.localeCompare(right.label));

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

function renderParticipantLegend(context: StatisticsContext) {
  return (
    <div className="cogita-statistics-legend">
      {context.participantSeries.map((participant) => (
        <div key={participant.key} className="cogita-statistics-legend-row">
          <span className="cogita-statistics-legend-dot" style={{ background: participant.color }} />
          <span className="cogita-statistics-legend-name">{participant.label}</span>
          <span>{formatFloat(participant.averageCorrectness, 1)}%</span>
          <span>{formatCount(participant.totalPoints)}</span>
        </div>
      ))}
    </div>
  );
}

function renderLineChartModule(context: StatisticsContext, metric: 'knowness' | 'runningPoints', yLabel: string) {
  const chartWidth = 940;
  const chartHeight = 240;
  const paddingX = 44;
  const paddingY = 20;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const source = context.participantSeries.filter((participant) => participant.points.length > 0);
  const xValues = source.flatMap((participant) => participant.points.map((point) => point.index));
  const minX = xValues.length > 0 ? Math.min(...xValues) : 0;
  const maxX = xValues.length > 0 ? Math.max(...xValues) : 1;
  const yValues = source.flatMap((participant) =>
    participant.points.map((point) => (metric === 'knowness' ? point.knowness : point.runningPoints))
  );
  const minY = yValues.length > 0 ? Math.min(...yValues) : 0;
  const maxY = yValues.length > 0 ? Math.max(...yValues) : 1;
  const safeMinY = Math.abs(maxY - minY) < 0.001 ? minY - 1 : minY;
  const safeMaxY = Math.abs(maxY - minY) < 0.001 ? maxY + 1 : maxY;

  const toX = (value: number) => {
    if (Math.abs(maxX - minX) < 0.001) return paddingX + plotWidth / 2;
    return paddingX + ((value - minX) / (maxX - minX)) * plotWidth;
  };
  const toY = (value: number) => {
    if (Math.abs(safeMaxY - safeMinY) < 0.001) return paddingY + plotHeight / 2;
    const normalized = (value - safeMinY) / (safeMaxY - safeMinY);
    return paddingY + (1 - normalized) * plotHeight;
  };

  const yTicks = 5;
  const xTicks = 5;

  return (
    <div className="cogita-statistics-chart-card">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: yTicks + 1 }).map((_, index) => {
          const ratio = index / yTicks;
          const value = safeMaxY - (safeMaxY - safeMinY) * ratio;
          const y = paddingY + ratio * plotHeight;
          return (
            <g key={`y-tick-${index}`}>
              <line x1={paddingX} y1={y} x2={paddingX + plotWidth} y2={y} stroke="rgba(120, 170, 220, 0.18)" />
              <text x={8} y={y + 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                {formatFloat(value, metric === 'knowness' ? 1 : 0)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }).map((_, index) => {
          const ratio = index / xTicks;
          const value = minX + (maxX - minX) * ratio;
          const x = paddingX + ratio * plotWidth;
          return (
            <g key={`x-tick-${index}`}>
              <line x1={x} y1={paddingY} x2={x} y2={paddingY + plotHeight} stroke="rgba(120, 170, 220, 0.12)" />
              <text x={x - 8} y={chartHeight - 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                {formatFloat(value, 0)}
              </text>
            </g>
          );
        })}
        {source.map((participant) => {
          const points = participant.points.map((point) => ({
            x: toX(point.index),
            y: toY(metric === 'knowness' ? point.knowness : point.runningPoints)
          }));
          const line = buildLinePath(points);
          if (!line) return null;
          return (
            <g key={`line-${metric}-${participant.key}`}>
              <path d={line} stroke={participant.color} fill="none" strokeWidth={2.4} strokeLinecap="round" />
              {points.map((point, index) => (
                <circle key={`${participant.key}-${index}`} cx={point.x} cy={point.y} r={2.1} fill={participant.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="cogita-help">{yLabel}</p>
      {renderParticipantLegend(context)}
    </div>
  );
}

function buildLinearRegression(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return null;
  const xAvg = mean(points.map((point) => point.x));
  const yAvg = mean(points.map((point) => point.y));
  const numerator = points.reduce((sum, point) => sum + (point.x - xAvg) * (point.y - yAvg), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - xAvg) ** 2, 0);
  if (Math.abs(denominator) < 0.000001) return null;
  const slope = numerator / denominator;
  const intercept = yAvg - slope * xAvg;
  return { slope, intercept };
}

const STATISTICS_MODULES: StatisticsModule[] = [
  {
    id: 'metrics',
    title: 'Numbered metrics',
    subtitle: 'Key indicators collected from the current scope.',
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
  },
  {
    id: 'knowness-words',
    title: 'Knowness words',
    subtitle: 'Best and worst known words for the current scope.',
    isAvailable: (context) => context.bestKnownWords.length > 0 || context.worstKnownWords.length > 0,
    render: (context) => (
      <div className="cogita-statistics-chart-card">
        <div className="cogita-statistics-word-lists">
          <section>
            <p className="cogita-user-kicker">Best known words</p>
            {context.bestKnownWords.length > 0 ? (
              <ol className="cogita-statistics-word-list">
                {context.bestKnownWords.map((item, index) => (
                  <li key={`best-${item.infoId}`} className="cogita-statistics-word-row">
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
                  <li key={`worst-${item.infoId}`} className="cogita-statistics-word-row">
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
    title: 'Knowness graph',
    subtitle: 'Temporal knowness trend per participant.',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.points.length > 0),
    render: (context) => renderLineChartModule(context, 'knowness', 'Knowness values are computed over time by the shared temporal algorithm.')
  },
  {
    id: 'score-line',
    title: 'Score graph',
    subtitle: 'Running points timeline per participant.',
    isAvailable: (context) => context.participantSeries.some((participant) => participant.points.length > 0),
    render: (context) => renderLineChartModule(context, 'runningPoints', 'Running points show cumulative score progression in this scope.')
  },
  {
    id: 'participant-bars',
    title: 'Bar chart',
    subtitle: 'Total points per participant.',
    isAvailable: (context) => context.participantSeries.length > 0,
    render: (context) => {
      const chartWidth = 940;
      const chartHeight = 260;
      const paddingX = 40;
      const paddingY = 24;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;
      const participants = context.participantSeries.slice(0, 12);
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
                  <rect x={x} y={y} width={width} height={barHeight} rx={6} fill={participant.color} opacity={0.85} />
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
          {renderParticipantLegend(context)}
        </div>
      );
    }
  },
  {
    id: 'flow',
    title: 'Flow chart',
    subtitle: 'Most frequent transition paths between event types.',
    isAvailable: (context) => context.transitions.length > 0,
    render: (context) => {
      const chartWidth = 940;
      const chartHeight = 260;
      const transitions = context.transitions.slice(0, 10);
      const fromNodes = Array.from(new Set(transitions.map((transition) => transition.from)));
      const toNodes = Array.from(new Set(transitions.map((transition) => transition.to)));
      const leftX = 150;
      const rightX = 790;
      const top = 26;
      const bottom = chartHeight - 26;
      const fromSpacing = fromNodes.length > 1 ? (bottom - top) / (fromNodes.length - 1) : 0;
      const toSpacing = toNodes.length > 1 ? (bottom - top) / (toNodes.length - 1) : 0;
      const fromY = new Map<string, number>();
      const toY = new Map<string, number>();
      fromNodes.forEach((node, index) => {
        fromY.set(node, top + fromSpacing * index);
      });
      toNodes.forEach((node, index) => {
        toY.set(node, top + toSpacing * index);
      });
      const maxCount = Math.max(1, ...transitions.map((transition) => transition.count));

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            {transitions.map((transition, index) => {
              const y1 = fromY.get(transition.from) ?? top;
              const y2 = toY.get(transition.to) ?? top;
              const controlX = (leftX + rightX) / 2;
              const width = 1.6 + (transition.count / maxCount) * 8;
              return (
                <path
                  key={`flow-${transition.from}-${transition.to}-${index}`}
                  d={`M ${leftX} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${rightX} ${y2}`}
                  fill="none"
                  stroke="rgba(130, 220, 255, 0.74)"
                  strokeWidth={width}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
            {fromNodes.map((node) => {
              const y = fromY.get(node) ?? top;
              return (
                <g key={`from-${node}`}>
                  <circle cx={leftX} cy={y} r={5} fill="rgba(122, 190, 255, 0.92)" />
                  <text x={leftX - 10} y={y + 4} textAnchor="end" fill="rgba(208, 229, 252, 0.95)" fontSize="11">
                    {node}
                  </text>
                </g>
              );
            })}
            {toNodes.map((node) => {
              const y = toY.get(node) ?? top;
              return (
                <g key={`to-${node}`}>
                  <circle cx={rightX} cy={y} r={5} fill="rgba(122, 248, 222, 0.9)" />
                  <text x={rightX + 10} y={y + 4} textAnchor="start" fill="rgba(208, 229, 252, 0.95)" fontSize="11">
                    {node}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="cogita-help">Flow width reflects how often a transition occurred.</p>
        </div>
      );
    }
  },
  {
    id: 'correlation',
    title: 'Correlation chart',
    subtitle: 'Answer time versus correctness.',
    isAvailable: (context) => context.answerEvents.some((event) => event.durationSeconds !== null),
    render: (context) => {
      const points = context.answerEvents
        .filter((event) => event.durationSeconds !== null)
        .map((event) => ({
          x: event.durationSeconds ?? 0,
          y: event.correctness * 100,
          color: event.color
        }));

      const chartWidth = 940;
      const chartHeight = 250;
      const paddingX = 44;
      const paddingY = 22;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;

      const minX = 0;
      const maxX = Math.max(1, ...points.map((point) => point.x));
      const minY = 0;
      const maxY = 100;
      const toX = (value: number) => paddingX + ((value - minX) / Math.max(0.001, maxX - minX)) * plotWidth;
      const toY = (value: number) => paddingY + (1 - (value - minY) / Math.max(0.001, maxY - minY)) * plotHeight;

      const regression = buildLinearRegression(points);
      const regressionPoints =
        regression === null
          ? null
          : [
              { x: minX, y: clamp(regression.slope * minX + regression.intercept, 0, 100) },
              { x: maxX, y: clamp(regression.slope * maxX + regression.intercept, 0, 100) }
            ];

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            {Array.from({ length: 5 }).map((_, index) => {
              const ratio = index / 4;
              const y = paddingY + ratio * plotHeight;
              const label = formatFloat(100 - ratio * 100, 0);
              return (
                <g key={`corr-y-${index}`}>
                  <line x1={paddingX} y1={y} x2={paddingX + plotWidth} y2={y} stroke="rgba(110, 160, 220, 0.15)" />
                  <text x={8} y={y + 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                    {label}%
                  </text>
                </g>
              );
            })}
            {Array.from({ length: 5 }).map((_, index) => {
              const ratio = index / 4;
              const x = paddingX + ratio * plotWidth;
              const label = formatFloat(minX + ratio * (maxX - minX), 1);
              return (
                <g key={`corr-x-${index}`}>
                  <line x1={x} y1={paddingY} x2={x} y2={paddingY + plotHeight} stroke="rgba(110, 160, 220, 0.12)" />
                  <text x={x - 8} y={chartHeight - 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                    {label}s
                  </text>
                </g>
              );
            })}
            {regressionPoints ? (
              <path
                d={buildLinePath(regressionPoints.map((point) => ({ x: toX(point.x), y: toY(point.y) })))}
                stroke="rgba(245, 227, 140, 0.92)"
                strokeWidth={2.2}
                fill="none"
              />
            ) : null}
            {points.map((point, index) => (
              <circle key={`corr-point-${index}`} cx={toX(point.x)} cy={toY(point.y)} r={3.1} fill={point.color} opacity={0.9} />
            ))}
          </svg>
          <p className="cogita-help">
            {context.averageDurationSeconds === null
              ? 'No timed answers available yet.'
              : `Average response time: ${formatFloat(context.averageDurationSeconds, 2)} s`}
          </p>
          {renderParticipantLegend(context)}
        </div>
      );
    }
  },
  {
    id: 'pyramid',
    title: 'Pyramid ranking',
    subtitle: 'Point-weighted participant hierarchy.',
    isAvailable: (context) => context.participantSeries.length > 0,
    render: (context) => {
      const ranked = context.participantSeries.slice(0, 8);
      const max = Math.max(1, ...ranked.map((participant) => participant.totalPoints));
      return (
        <div className="cogita-statistics-chart-card">
          <div className="cogita-statistics-pyramid">
            {ranked.map((participant, index) => {
              const widthPercent = 35 + (participant.totalPoints / max) * 65;
              return (
                <div key={`pyramid-${participant.key}`} className="cogita-statistics-pyramid-row">
                  <span className="cogita-statistics-pyramid-rank">#{index + 1}</span>
                  <div className="cogita-statistics-pyramid-bar-wrap">
                    <div
                      className="cogita-statistics-pyramid-bar"
                      style={{ width: `${widthPercent}%`, background: participant.color }}
                    >
                      <span>{participant.label}</span>
                      <strong>{formatCount(participant.totalPoints)}</strong>
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
    id: 'streamgraph',
    title: 'Streamgraph',
    subtitle: 'Round-by-round activity distribution.',
    isAvailable: (context) => context.rounds.length >= 2 && context.streamBands.length >= 2,
    render: (context) => {
      const chartWidth = 940;
      const chartHeight = 250;
      const paddingX = 40;
      const paddingY = 22;
      const plotWidth = chartWidth - paddingX * 2;
      const plotHeight = chartHeight - paddingY * 2;

      const allY = context.streamBands.flatMap((band) => band.points.flatMap((point) => [point.y0, point.y1]));
      const minY = allY.length > 0 ? Math.min(...allY) : -1;
      const maxY = allY.length > 0 ? Math.max(...allY) : 1;

      const toX = (value: number) => {
        if (context.rounds.length <= 1) return paddingX + plotWidth / 2;
        return paddingX + (value / (context.rounds.length - 1)) * plotWidth;
      };
      const toY = (value: number) => {
        if (Math.abs(maxY - minY) < 0.001) return paddingY + plotHeight / 2;
        const ratio = (value - minY) / (maxY - minY);
        return paddingY + (1 - ratio) * plotHeight;
      };

      return (
        <div className="cogita-statistics-chart-card">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="cogita-statistics-chart" preserveAspectRatio="xMidYMid meet">
            {Array.from({ length: 5 }).map((_, index) => {
              const y = paddingY + (index / 4) * plotHeight;
              return <line key={`stream-grid-${index}`} x1={paddingX} y1={y} x2={paddingX + plotWidth} y2={y} stroke="rgba(110, 160, 220, 0.12)" />;
            })}
            {context.streamBands.map((band) => {
              const upper = band.points.map((point) => ({ x: toX(point.x), y: toY(point.y1) }));
              const lower = band.points.map((point) => ({ x: toX(point.x), y: toY(point.y0) }));
              const areaPath = buildAreaPath(upper, lower);
              if (!areaPath) return null;
              return <path key={`stream-${band.key}`} d={areaPath} fill={band.color} opacity={0.58} stroke={band.color} strokeWidth={1} />;
            })}
            {context.rounds.map((round, index) => {
              const x = toX(index);
              return (
                <text key={`round-${round}`} x={x - 8} y={chartHeight - 4} fill="rgba(186, 209, 238, 0.8)" fontSize="10">
                  {round + 1}
                </text>
              );
            })}
          </svg>
          <p className="cogita-help">Each layer shows how strongly one participant contributed answers in each round.</p>
          {renderParticipantLegend(context)}
        </div>
      );
    }
  }
];

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
  const [state, setState] = useState<CogitaStatisticsResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slideIndex, setSlideIndex] = useState(0);
  const appliedInitialModuleRef = useRef<string | null>(null);
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

  const modules = useMemo(() => {
    if (!statisticsContext) return [] as StatisticsModule[];
    return STATISTICS_MODULES.filter((module) => module.isAvailable(statisticsContext));
  }, [statisticsContext]);

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
  const hasMultipleSlides = modules.length > 1;

  return (
    <section className="cogita-library-panel cogita-statistics-panel">
      <div className="cogita-detail-header">
        <div>
          <p className="cogita-user-kicker">{title}</p>
          <h3 className="cogita-detail-title">
            {resolvedStatus === 'loading'
              ? 'Loading...'
              : resolvedStatus === 'error'
              ? 'Statistics unavailable'
              : `${resolvedState?.totalAnswers ?? 0} checked answers`}
          </h3>
        </div>
      </div>

      {resolvedStatus === 'ready' && resolvedState && statisticsContext ? (
        <>
          <div className="cogita-statistics-summary">
            <div className="cogita-statistics-chip">
              <strong>{formatFloat(resolvedState.averageCorrectness, 1)}%</strong>
              <span>Average correctness</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>{formatCount(resolvedState.totalPoints)}</strong>
              <span>Total points</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>{formatCount(statisticsContext.participantSeries.length)}</strong>
              <span>Participants</span>
            </div>
            <div className="cogita-statistics-chip">
              <strong>
                {statisticsContext.averageDurationSeconds === null ? 'n/a' : `${formatFloat(statisticsContext.averageDurationSeconds, 2)} s`}
              </strong>
              <span>Average response time</span>
            </div>
          </div>

          {currentModule ? (
            <div className="cogita-statistics-carousel">
              <div className="cogita-statistics-carousel-header">
                <div>
                  <p className="cogita-user-kicker">{currentModule.title}</p>
                  <p className="cogita-help">{currentModule.subtitle}</p>
                </div>
                {hasMultipleSlides ? (
                  <div className="cogita-statistics-carousel-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSlideIndex((current) => (current <= 0 ? modules.length - 1 : current - 1))}
                    >
                      Previous
                    </button>
                    <span className="cogita-statistics-slide-count">
                      {slideIndex + 1} / {modules.length}
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSlideIndex((current) => (current + 1) % modules.length)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="cogita-statistics-carousel-window">
                <div className="cogita-statistics-carousel-track" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
                  {modules.map((module) => (
                    <article key={module.id} className="cogita-statistics-slide">
                      {module.render(statisticsContext)}
                    </article>
                  ))}
                </div>
              </div>

              {hasMultipleSlides ? (
                <div className="cogita-statistics-carousel-dots">
                  {modules.map((module, index) => (
                    <button
                      key={module.id}
                      type="button"
                      className={`cogita-statistics-dot ${index === slideIndex ? 'active' : ''}`}
                      onClick={() => setSlideIndex(index)}
                      aria-label={`Open statistics slide ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="cogita-library-hint">No statistics are currently available for this scope.</p>
          )}
        </>
      ) : resolvedStatus === 'error' ? (
        <p className="cogita-library-hint">Failed to load statistics.</p>
      ) : null}
    </section>
  );
}
