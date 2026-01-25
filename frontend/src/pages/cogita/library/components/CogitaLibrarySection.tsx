import { forwardRef, useRef } from 'react';
import { CARD_TYPES } from '../data';
import type { IndexCardLibraryState } from '../useIndexCardLibrary';
import { CogitaCardCreate } from './CogitaCardCreate';
import { CogitaCardDetail } from './CogitaCardDetail';
import { CogitaCardList } from './CogitaCardList';
import { CogitaLibraryFilters } from './CogitaLibraryFilters';

export const CogitaLibrarySection = forwardRef<HTMLElement, {
  library: IndexCardLibraryState;
  onBackToOverview: () => void;
}>(function CogitaLibrarySection({ library, onBackToOverview }, ref) {
  const addFormRef = useRef<HTMLDivElement | null>(null);

  const openAddForm = () => {
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="cogita-library" ref={ref} id="cogita-library">
      <div className="cogita-library-inner">
        <header className="cogita-library-header">
          <div>
            <p className="cogita-user-kicker">Index cards</p>
            <h2 className="cogita-library-title">Index card library</h2>
            <p className="cogita-library-subtitle">
              Search by tag, review two-way vocabulary cards, and add new ones.
            </p>
          </div>
          <div className="cogita-library-actions">
            <button type="button" className="cta ghost" onClick={onBackToOverview}>
              Back to overview
            </button>
            <button type="button" className="cta" onClick={openAddForm}>
              New card
            </button>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <CogitaLibraryFilters
              tagQuery={library.tagQuery}
              onTagQueryChange={library.setTagQuery}
              activeTags={library.activeTags}
              visibleTagCounts={library.visibleTagCounts}
              onToggleTag={library.toggleTagFilter}
              onClearFilters={library.clearFilters}
              viewMode={library.viewMode}
              onViewModeChange={library.setViewMode}
            />

            <div className="cogita-card-count">
              <span>{library.filteredCards.length} cards</span>
              <span>{library.activeTags.length ? `${library.activeTags.length} tag filters` : 'All tags'}</span>
            </div>

            <CogitaCardList
              cards={library.filteredCards}
              selectedCardId={library.selectedCardId}
              activeTags={library.activeTags}
              viewMode={library.viewMode}
              cardTypeLabel={library.cardTypeLabel}
              onSelectCard={library.setSelectedCardId}
              onToggleTag={library.toggleTagFilter}
              onRemoveCard={library.removeCard}
              onClearFilters={library.clearFilters}
            />
          </div>

          <div className="cogita-library-panel">
            <CogitaCardDetail
              selectedCard={library.selectedCard}
              activeTags={library.activeTags}
              cardTypeLabel={library.cardTypeLabel}
              directionLabel={library.directionLabel}
              frontLabel={library.frontLabel}
              backLabel={library.backLabel}
              frontValue={library.frontValue}
              backValue={library.backValue}
              isFlipped={library.isFlipped}
              onSetFlipped={library.setIsFlipped}
              onToggleFlip={() => library.setIsFlipped((prev) => !prev)}
              onSwapDirection={() => {
                library.setDirection((prev) => (prev === 'A_TO_B' ? 'B_TO_A' : 'A_TO_B'));
                library.setIsFlipped(false);
              }}
              onRemoveCard={library.removeCard}
              onSelectRelative={library.selectRelativeCard}
              onToggleTag={library.toggleTagFilter}
              onOpenAddForm={openAddForm}
            />

            <CogitaCardCreate
              ref={addFormRef}
              cardTypes={CARD_TYPES}
              selectedTypeId={library.newCardType}
              onSelectType={library.setNewCardType}
              canCreateType={library.canCreateType}
              draft={library.draft}
              onUpdateDraft={library.updateDraft}
              draftTagInput={library.draftTagInput}
              onDraftTagInputChange={library.setDraftTagInput}
              onCommitDraftTag={library.commitDraftTag}
              onAddDraftTag={library.addDraftTag}
              onRemoveDraftTag={library.removeDraftTag}
              onUseActiveTags={library.useActiveTags}
              tagSuggestions={library.tagSuggestions}
              formError={library.formError}
              isFormValid={library.isFormValid}
              onSubmit={library.addNewCard}
              onReset={library.resetDraft}
            />
          </div>
        </div>
      </div>
    </section>
  );
});
