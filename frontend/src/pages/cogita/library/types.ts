export type CardTypeId = 'vocab-bidi' | 'definition' | 'quote' | 'process';

export type CardType = {
  id: CardTypeId;
  label: string;
  description: string;
  helper: string;
  available: boolean;
};

export type IndexCard = {
  id: string;
  type: CardTypeId;
  sideA: string;
  sideB: string;
  sideALabel?: string;
  sideBLabel?: string;
  tags: string[];
  note?: string;
  createdAt: string;
  lastReviewed?: string;
};

export type DraftCard = {
  sideA: string;
  sideB: string;
  sideALabel: string;
  sideBLabel: string;
  note: string;
  tags: string[];
};

export type ViewMode = 'grid' | 'list';

export type ReviewDirection = 'A_TO_B' | 'B_TO_A';

export type LibraryMode = 'detail' | 'collection' | 'list';

export const normalizeTag = (value: string) =>
  value.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');

export const buildCardId = () =>
  `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
