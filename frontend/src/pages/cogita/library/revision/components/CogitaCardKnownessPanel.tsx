import { useMemo, useState } from 'react';
import { computeKnowness } from '../../../../../cogita/revision/knowness';
import type { RevisionOutcomePayload } from '../../../../../cogita/revision/outcomes';

type PeriodId = 'hour' | 'day' | 'month' | 'year';

const PERIODS: Array<{ id: PeriodId; label: string; ms: number }> = [
  { id: 'hour', label: '1h', ms: 60 * 60 * 1000 },
  { id: 'day', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: 'month', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'year', label: '1y', ms: 365 * 24 * 60 * 60 * 1000 }
];

export function CogitaCardKnownessPanel({ outcomes }: { outcomes: RevisionOutcomePayload[] }) {
  const [period, setPeriod] = useState<PeriodId>('day');

  const summary = useMemo(() => {
    const selected = PERIODS.find((item) => item.id === period) ?? PERIODS[1];
    const minUtc = Date.now() - selected.ms;
    const filtered = outcomes.filter((entry) => new Date(entry.createdUtc).getTime() >= minUtc);
    return computeKnowness(filtered);
  }, [outcomes, period]);

  return (
    <div className="cogita-revision-insight-card">
      <p className="cogita-user-kicker">Card knowness</p>
      <div className="cogita-form-actions">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ghost"
            data-active={period === item.id}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <h3 className="cogita-detail-title">{summary.score.toFixed(1)} / 100</h3>
      <p>{summary.correct} / {summary.total}</p>
    </div>
  );
}
