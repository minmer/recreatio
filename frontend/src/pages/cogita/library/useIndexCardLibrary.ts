import { useEffect, useMemo, useState } from 'react';
import { CARD_TYPES, MOCK_INDEX_CARDS } from './data';
import {
  buildCardId,
  normalizeTag,
  type CardTypeId,
  type DraftCard,
  type IndexCard,
  type ReviewDirection,
  type ViewMode
} from './types';

const DEFAULT_DRAFT: DraftCard = {
  sideA: '',
  sideB: '',
  sideALabel: '',
  sideBLabel: '',
  note: '',
  tags: []
};

export function useIndexCardLibrary(initialCards: IndexCard[] = MOCK_INDEX_CARDS) {
  const [cards, setCards] = useState<IndexCard[]>(() => initialCards);
  const [selectedCardId, setSelectedCardId] = useState(() => initialCards[0]?.id ?? '');
  const [tagQuery, setTagQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [direction, setDirection] = useState<ReviewDirection>('A_TO_B');
  const [isFlipped, setIsFlipped] = useState(false);
  const [newCardType, setNewCardType] = useState<CardTypeId>('vocab-bidi');
  const [draft, setDraft] = useState<DraftCard>(DEFAULT_DRAFT);
  const [draftTagInput, setDraftTagInput] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setIsFlipped(false);
    setDirection('A_TO_B');
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId && cards.length) {
      setSelectedCardId(cards[0].id);
      return;
    }
    if (selectedCardId && !cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(cards[0]?.id ?? '');
    }
  }, [cards, selectedCardId]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cards.forEach((card) => {
      card.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const tagQueryTokens = useMemo(() => {
    return tagQuery
      .split(',')
      .map((token) => normalizeTag(token))
      .filter(Boolean);
  }, [tagQuery]);

  const tagSearchToken = useMemo(() => {
    const pieces = tagQuery.split(',');
    return normalizeTag(pieces[pieces.length - 1] ?? '');
  }, [tagQuery]);

  const visibleTagCounts = useMemo(() => {
    if (!tagSearchToken) return tagCounts;
    return tagCounts.filter(([tag]) => tag.includes(tagSearchToken));
  }, [tagCounts, tagSearchToken]);

  const tagSuggestions = useMemo(() => {
    return tagCounts.filter(([tag]) => !draft.tags.includes(tag));
  }, [tagCounts, draft.tags]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesActive = activeTags.length === 0 || activeTags.every((tag) => card.tags.includes(tag));
      const matchesQuery =
        tagQueryTokens.length === 0 || tagQueryTokens.some((token) => card.tags.some((tag) => tag.includes(token)));
      return matchesActive && matchesQuery;
    });
  }, [cards, activeTags, tagQueryTokens]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const selectedType = useMemo(
    () => CARD_TYPES.find((type) => type.id === newCardType) ?? CARD_TYPES[0],
    [newCardType]
  );

  const totalCards = cards.length;
  const totalTags = tagCounts.length;
  const canCreateType = selectedType?.available ?? false;
  const isFormValid = canCreateType && draft.sideA.trim().length > 0 && draft.sideB.trim().length > 0;

  const toggleTagFilter = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const clearFilters = () => {
    setActiveTags([]);
    setTagQuery('');
  };

  const updateDraft = (patch: Partial<DraftCard>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFormError('');
  };

  const addDraftTag = (rawTag: string) => {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    setDraft((prev) => {
      if (prev.tags.includes(tag)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
    setFormError('');
  };

  const removeDraftTag = (tag: string) => {
    setDraft((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
  };

  const commitDraftTag = () => {
    if (!draftTagInput.trim()) return;
    addDraftTag(draftTagInput);
    setDraftTagInput('');
  };

  const useActiveTags = () => {
    if (!activeTags.length) return;
    setDraft((prev) => {
      const nextTags = Array.from(new Set([...prev.tags, ...activeTags]));
      return { ...prev, tags: nextTags };
    });
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
    setDraftTagInput('');
    setFormError('');
  };

  const addNewCard = () => {
    if (!canCreateType) {
      setFormError('This card type is not ready yet.');
      return;
    }
    const sideA = draft.sideA.trim();
    const sideB = draft.sideB.trim();
    if (!sideA || !sideB) {
      setFormError('Side A and side B are required.');
      return;
    }
    const newCard: IndexCard = {
      id: buildCardId(),
      type: newCardType,
      sideA,
      sideB,
      sideALabel: draft.sideALabel.trim() || undefined,
      sideBLabel: draft.sideBLabel.trim() || undefined,
      note: draft.note.trim() || undefined,
      tags: draft.tags,
      createdAt: new Date().toISOString().slice(0, 10),
      lastReviewed: 'just now'
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedCardId(newCard.id);
    setIsFlipped(false);
    setDirection('A_TO_B');
    resetDraft();
  };

  const removeCard = (cardId: string) => {
    setCards((prev) => {
      const next = prev.filter((card) => card.id !== cardId);
      if (selectedCardId === cardId) {
        setSelectedCardId(next[0]?.id ?? '');
      }
      return next;
    });
  };

  const selectRelativeCard = (offset: number) => {
    if (!filteredCards.length) return;
    const currentIndex = filteredCards.findIndex((card) => card.id === selectedCardId);
    const baseIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (baseIndex + offset + filteredCards.length) % filteredCards.length;
    setSelectedCardId(filteredCards[nextIndex].id);
  };

  const cardTypeLabel = (typeId: CardTypeId) =>
    CARD_TYPES.find((type) => type.id === typeId)?.label ?? 'Index card';

  const directionLabel = direction === 'A_TO_B' ? 'A -> B' : 'B -> A';
  const frontLabel = selectedCard
    ? direction === 'A_TO_B'
      ? selectedCard.sideALabel ?? 'Side A'
      : selectedCard.sideBLabel ?? 'Side B'
    : '';
  const backLabel = selectedCard
    ? direction === 'A_TO_B'
      ? selectedCard.sideBLabel ?? 'Side B'
      : selectedCard.sideALabel ?? 'Side A'
    : '';
  const frontValue = selectedCard
    ? direction === 'A_TO_B'
      ? selectedCard.sideA
      : selectedCard.sideB
    : '';
  const backValue = selectedCard
    ? direction === 'A_TO_B'
      ? selectedCard.sideB
      : selectedCard.sideA
    : '';

  return {
    cards,
    setCards,
    selectedCardId,
    setSelectedCardId,
    tagQuery,
    setTagQuery,
    activeTags,
    setActiveTags,
    viewMode,
    setViewMode,
    direction,
    setDirection,
    isFlipped,
    setIsFlipped,
    newCardType,
    setNewCardType,
    draft,
    setDraft,
    updateDraft,
    draftTagInput,
    setDraftTagInput,
    formError,
    tagCounts,
    visibleTagCounts,
    tagSuggestions,
    filteredCards,
    selectedCard,
    selectedType,
    totalCards,
    totalTags,
    canCreateType,
    isFormValid,
    toggleTagFilter,
    clearFilters,
    addDraftTag,
    removeDraftTag,
    commitDraftTag,
    useActiveTags,
    resetDraft,
    addNewCard,
    removeCard,
    selectRelativeCard,
    cardTypeLabel,
    directionLabel,
    frontLabel,
    backLabel,
    frontValue,
    backValue
  };
}

export type IndexCardLibraryState = ReturnType<typeof useIndexCardLibrary>;
