import type { CogitaCoreRunStatistics } from '../../../../../lib/api';
import { buildRevisionStatisticsModel, RevisionStatistics } from './primitives/RevisionStatistics';
import { RevisionScoreboardLarge } from './primitives/RevisionScoreboardLarge';
import { RevisionScoreboardSmall } from './primitives/RevisionScoreboardSmall';

export function RevisionRuntimeScoreboard({
  statistics,
  participantId,
  labels
}: {
  statistics: CogitaCoreRunStatistics | null;
  participantId?: string | null;
  labels: {
    statsTitle: string;
    attemptsLabel: string;
    correctLabel: string;
    wrongLabel: string;
    blankLabel: string;
    knownessLabel: string;
    pointsLabel: string;
  };
}) {
  const runtimeStats = buildRevisionStatisticsModel({ statistics });

  if (!statistics) {
    return <RevisionStatistics stats={runtimeStats} title={labels.statsTitle} emptyLabel="No statistics yet." />;
  }

  return (
    <>
      <RevisionStatistics
        stats={runtimeStats}
        title={labels.statsTitle}
        labels={{
          attemptsLabel: labels.attemptsLabel,
          correctLabel: labels.correctLabel,
          wrongLabel: labels.wrongLabel,
          blankLabel: labels.blankLabel,
          knownessLabel: labels.knownessLabel,
          pointsLabel: labels.pointsLabel
        }}
      />
      <RevisionScoreboardSmall
        statistics={statistics}
        participantId={participantId}
        labels={{
          pointsLabel: labels.pointsLabel,
          knownessLabel: labels.knownessLabel
        }}
      />
      {statistics.participants.length > 0 ? (
        <RevisionScoreboardLarge
          statistics={statistics}
          participantId={participantId}
          labels={{
            correctLabel: labels.correctLabel,
            knownessLabel: labels.knownessLabel,
            pointsLabel: labels.pointsLabel
          }}
        />
      ) : null}
    </>
  );
}
