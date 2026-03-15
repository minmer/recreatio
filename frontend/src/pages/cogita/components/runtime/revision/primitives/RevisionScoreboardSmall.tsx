import type { CogitaCoreRunStatistics } from '../../../../../../lib/api';

export function RevisionScoreboardSmall({
  statistics,
  participantId,
  labels
}: {
  statistics: CogitaCoreRunStatistics | null;
  participantId?: string | null;
  labels: {
    pointsLabel: string;
    knownessLabel: string;
  };
}) {
  if (!statistics || statistics.participants.length === 0) {
    return <p>No participants yet.</p>;
  }

  const top = [...statistics.participants]
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .slice(0, 3);
  const own = participantId
    ? statistics.participants.find((item) => item.participantId === participantId) ?? null
    : null;

  return (
    <div className="cogita-core-run-participants">
      {top.map((item, index) => (
        <div key={item.participantId} className="cogita-core-run-participant-row">
          <strong>
            #{index + 1} {item.displayName}
          </strong>
          <span>
            {labels.pointsLabel}: {item.totalPoints} · {labels.knownessLabel.toLowerCase()} {item.knownessScore.toFixed(1)}
          </span>
        </div>
      ))}
      {own && !top.some((item) => item.participantId === own.participantId) ? (
        <div className="cogita-core-run-participant-row" style={{ borderColor: 'rgba(111, 214, 255, 0.75)' }}>
          <strong>{own.displayName}</strong>
          <span>
            {labels.pointsLabel}: {own.totalPoints} · {labels.knownessLabel.toLowerCase()} {own.knownessScore.toFixed(1)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
