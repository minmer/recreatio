import { CogitaKnowledgeSearch, type CogitaKnowledgeSearchResult } from './CogitaKnowledgeSearch';

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
  if (!open) return null;

  return (
    <div className="cogita-overlay" role="dialog" aria-modal="true">
      <div className="cogita-overlay-card">
        <div className="cogita-detail-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>{closeLabel}</button>
        </div>
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
      </div>
    </div>
  );
}
