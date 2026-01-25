import { forwardRef } from 'react';
import type { CardType, CardTypeId, DraftCard } from '../types';

export const CogitaCardCreate = forwardRef<HTMLDivElement, {
  cardTypes: CardType[];
  selectedTypeId: CardTypeId;
  onSelectType: (typeId: CardTypeId) => void;
  canCreateType: boolean;
  draft: DraftCard;
  onUpdateDraft: (patch: Partial<DraftCard>) => void;
  draftTagInput: string;
  onDraftTagInputChange: (value: string) => void;
  onCommitDraftTag: () => void;
  onAddDraftTag: (tag: string) => void;
  onRemoveDraftTag: (tag: string) => void;
  onUseActiveTags: () => void;
  tagSuggestions: Array<[string, number]>;
  formError: string;
  isFormValid: boolean;
  onSubmit: () => void;
  onReset: () => void;
}>(function CogitaCardCreate(
  {
    cardTypes,
    selectedTypeId,
    onSelectType,
    canCreateType,
    draft,
    onUpdateDraft,
    draftTagInput,
    onDraftTagInputChange,
    onCommitDraftTag,
    onAddDraftTag,
    onRemoveDraftTag,
    onUseActiveTags,
    tagSuggestions,
    formError,
    isFormValid,
    onSubmit,
    onReset
  },
  ref
) {
  return (
    <section className="cogita-library-create" ref={ref}>
      <div className="cogita-detail-header">
        <div>
          <p className="cogita-user-kicker">New card</p>
          <h3 className="cogita-detail-title">Create an index card</h3>
        </div>
        <button type="button" className="ghost" onClick={onReset}>
          Reset form
        </button>
      </div>

      <div className="cogita-type-grid">
        {cardTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            className="cogita-type-card"
            data-active={selectedTypeId === type.id}
            disabled={!type.available}
            onClick={() => {
              if (!type.available) return;
              onSelectType(type.id);
            }}
          >
            <span className="cogita-type-label">{type.label}</span>
            <span className="cogita-type-desc">{type.description}</span>
            {!type.available ? <span className="cogita-type-badge">Soon</span> : null}
            <span className="cogita-type-helper">{type.helper}</span>
          </button>
        ))}
      </div>

      {canCreateType ? (
        <form
          className="cogita-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="cogita-field">
            <span>Side A label</span>
            <input
              type="text"
              value={draft.sideALabel}
              onChange={(event) => onUpdateDraft({ sideALabel: event.target.value })}
              placeholder="e.g. Latin"
            />
          </label>
          <label className="cogita-field">
            <span>Side B label</span>
            <input
              type="text"
              value={draft.sideBLabel}
              onChange={(event) => onUpdateDraft({ sideBLabel: event.target.value })}
              placeholder="e.g. English"
            />
          </label>
          <label className="cogita-field">
            <span>Side A term</span>
            <input
              type="text"
              value={draft.sideA}
              onChange={(event) => onUpdateDraft({ sideA: event.target.value })}
              placeholder="e.g. gratia"
              required
            />
          </label>
          <label className="cogita-field">
            <span>Side B term</span>
            <input
              type="text"
              value={draft.sideB}
              onChange={(event) => onUpdateDraft({ sideB: event.target.value })}
              placeholder="e.g. grace"
              required
            />
          </label>
          <label className="cogita-field full">
            <span>Notes</span>
            <textarea
              value={draft.note}
              onChange={(event) => onUpdateDraft({ note: event.target.value })}
              placeholder="Context, source, or usage notes."
            />
          </label>
          <div className="cogita-field full">
            <div className="cogita-tag-input-header">
              <span>Tags</span>
              <button type="button" className="ghost" onClick={onUseActiveTags}>
                Use active filters
              </button>
            </div>
            <div className="cogita-tag-input">
              {draft.tags.map((tag) => (
                <span key={tag} className="cogita-tag-pill">
                  {tag}
                  <button type="button" onClick={() => onRemoveDraftTag(tag)}>
                    x
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={draftTagInput}
                onChange={(event) => onDraftTagInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    onCommitDraftTag();
                  }
                  if (event.key === 'Backspace' && !draftTagInput && draft.tags.length) {
                    event.preventDefault();
                    onRemoveDraftTag(draft.tags[draft.tags.length - 1]);
                  }
                }}
                onBlur={onCommitDraftTag}
                placeholder="Add tag and press Enter"
              />
            </div>
            {tagSuggestions.length ? (
              <div className="cogita-tag-suggestions">
                {tagSuggestions.slice(0, 8).map(([tag]) => (
                  <button key={tag} type="button" className="cogita-tag-chip" onClick={() => onAddDraftTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {formError ? <p className="cogita-form-error">{formError}</p> : null}
          <div className="cogita-form-actions full">
            <button type="submit" className="cta" disabled={!isFormValid}>
              Add card
            </button>
            <button type="button" className="cta ghost" onClick={onReset}>
              Clear
            </button>
          </div>
        </form>
      ) : (
        <p className="cogita-form-disabled">
          This card type is not available yet. Choose the two-way vocabulary card for now.
        </p>
      )}
    </section>
  );
});
