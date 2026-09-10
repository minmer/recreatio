import type { CogitaCoreRunStatistics } from '../../../../../../lib/api';

export function RevisionScoreboardLarge({
  statistics,
  participantId,
  labels
}: {
  statistics: CogitaCoreRunStatistics;
  participantId?: string | null;
  labels: {
    correctLabel: string;
    knownessLabel: string;
    pointsLabel: string;
  };
}) {
  return (
    <div className="cogita-core-run-participants">
      {statistics.participants.map((item) => (
        <div
          key={item.participantId}
          className="cogita-core-run-participant-row"
          style={participantId === item.participantId ? { borderColor: 'rgba(111, 214, 255, 0.75)' } : undefined}
        >
          <strong>{item.displayName}</strong>
          <span>
            {item.correctCount}/{item.attemptCount} {labels.correctLabel.toLowerCase()} · {labels.knownessLabel.toLowerCase()}{' '}
            {item.knownessScore.toFixed(1)} · {labels.pointsLabel.toLowerCase()} {item.totalPoints}
          </span>
        </div>
      ))}
    </div>
  );
}
