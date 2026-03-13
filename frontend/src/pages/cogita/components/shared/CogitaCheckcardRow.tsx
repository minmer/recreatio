import type { CogitaCardSearchResult } from '../../../../lib/api';
import { formatCheckTarget } from '../workspace/checkcards/checkcardDisplay';

export function CogitaCheckcardRow({
  card,
  active,
  onClick
}: {
  card: CogitaCardSearchResult;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ghost cogita-checkcard-row ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span>{card.label}</span>
      <small>{formatCheckTarget(card)}</small>
    </button>
  );
}
