import { CogitaKnowledgeSearch, type CogitaKnowledgeSearchResult } from '../CogitaKnowledgeSearch';
import { CogitaSearchOverlayCard } from './CogitaSearchOverlayCard';

export function CogitaKnowledgeItemSearchOverlay({
  libraryId,
  open,
  title,
  closeLabel,
  searchLabel,
  searchPlaceholder,
  searchingLabel,
  emptyLabel,
  failedLabel,
  resultSuffixLabel,
  onClose,
  onSelect
}: {
  libraryId: string;
  open: boolean;
  title: string;
  closeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchingLabel: string;
  emptyLabel: string;
  failedLabel: string;
  resultSuffixLabel: string;
  onClose: () => void;
  onSelect: (result: CogitaKnowledgeSearchResult) => void;
}) {
  return (
    <CogitaSearchOverlayCard open={open} title={title} closeLabel={closeLabel} onClose={onClose}>
      <CogitaKnowledgeSearch
        libraryId={libraryId}
        searchLabel={searchLabel}
        searchPlaceholder={searchPlaceholder}
        searchingLabel={searchingLabel}
        emptyLabel={emptyLabel}
        failedLabel={failedLabel}
        resultSuffixLabel={resultSuffixLabel}
        requireLinkedCheckcards
        onKnowledgeItemSelect={onSelect}
      />
    </CogitaSearchOverlayCard>
  );
}
