import { useEffect, useMemo, useState } from 'react';

export type RevisionProgressBarTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type RevisionProgressBar = {
  id: string;
  label: string;
  startedUtc?: string | null;
  endsUtc?: string | null;
  durationMs?: number | null;
  tone?: RevisionProgressBarTone;
  hint?: string | null;
};

export type RevisionProgressLabels = {
  remainingLabel?: string;
  elapsedLabel?: string;
};

export const REVISION_PRIMITIVE_DEFAULT_LABELS = {
  progressTitle: 'Timers',
  sliderTitle: 'Checkcards',
  statisticsTitle: 'Statistics',
  remainingLabel: 'Remaining',
  elapsedLabel: 'Elapsed',
  previousAction: 'Previous',
  nextAction: 'Next',
  noCardsLabel: 'No checkcards yet.',
  noStatisticsLabel: 'No statistics yet.',
  attemptsLabel: 'Attempts',
  correctLabel: 'Correct',
  wrongLabel: 'Wrong',
  blankLabel: 'Blank',
  knownessLabel: 'Knowness',
  pointsLabel: 'Points',
  completionLabel: 'Completion',
  participantsLabel: 'Participants'
} as const;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function parseUtc(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.ceil(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resolveToneClass(tone: RevisionProgressBarTone | undefined) {
  if (tone === 'info') return 'tone-info';
  if (tone === 'success') return 'tone-success';
  if (tone === 'warning') return 'tone-warning';
  if (tone === 'danger') return 'tone-danger';
  return 'tone-neutral';
}

export function RevisionProgressBars({
  bars,
  title,
  labels
}: {
  bars: RevisionProgressBar[];
  title?: string;
  labels?: RevisionProgressLabels;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const handle = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(handle);
  }, []);

  const resolvedLabels = {
    remainingLabel: labels?.remainingLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.remainingLabel,
    elapsedLabel: labels?.elapsedLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.elapsedLabel
  };

  const renderedBars = useMemo(
    () =>
      bars
        .map((bar) => {
          const startMs = parseUtc(bar.startedUtc);
          const endMsFromUtc = parseUtc(bar.endsUtc);
          const rawDuration = Number(bar.durationMs ?? NaN);
          const durationMs = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

          let totalMs: number | null = durationMs;
          if (totalMs === null && startMs !== null && endMsFromUtc !== null) {
            totalMs = Math.max(0, endMsFromUtc - startMs);
          }

          let remainingMs: number | null = null;
          if (endMsFromUtc !== null) {
            remainingMs = Math.max(0, endMsFromUtc - nowMs);
          } else if (startMs !== null && totalMs !== null) {
            remainingMs = Math.max(0, startMs + totalMs - nowMs);
          }

          const elapsedMs = totalMs !== null && remainingMs !== null ? Math.max(0, totalMs - remainingMs) : null;
          const progressPct = totalMs !== null && remainingMs !== null && totalMs > 0
            ? clampPercent((elapsedMs / totalMs) * 100)
            : null;

          return {
            ...bar,
            totalMs,
            remainingMs,
            elapsedMs,
            progressPct
          };
        })
        .filter((bar) => bar.totalMs !== null || bar.remainingMs !== null),
    [bars, nowMs]
  );

  if (renderedBars.length === 0) {
    return null;
  }

  return (
    <article className="cogita-core-run-card">
      <p className="cogita-core-run-kicker">{title ?? REVISION_PRIMITIVE_DEFAULT_LABELS.progressTitle}</p>
      <div className="cogita-core-run-progress-stack">
        {renderedBars.map((bar) => (
          <div key={bar.id} className={`cogita-core-run-progress-card ${resolveToneClass(bar.tone)}`}>
            <div className="cogita-core-run-progress-head">
              <strong>{bar.label}</strong>
              {bar.remainingMs !== null ? <span>{formatDuration(bar.remainingMs)}</span> : null}
            </div>
            {bar.totalMs !== null && bar.progressPct !== null ? (
              <progress max={100} value={bar.progressPct} />
            ) : null}
            <div className="cogita-core-run-progress-meta">
              {bar.remainingMs !== null ? (
                <small>{resolvedLabels.remainingLabel}: {formatDuration(bar.remainingMs)}</small>
              ) : null}
              {bar.elapsedMs !== null ? (
                <small>{resolvedLabels.elapsedLabel}: {formatDuration(bar.elapsedMs)}</small>
              ) : null}
            </div>
            {bar.hint ? <p className="cogita-core-run-trace">{bar.hint}</p> : null}
          </div>
        ))}
      </div>
    </article>
  );
}
