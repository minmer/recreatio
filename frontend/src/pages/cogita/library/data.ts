import type { CardType, IndexCard } from './types';

export const CARD_TYPES: CardType[] = [
  {
    id: 'vocab-bidi',
    label: 'Two-way vocabulary',
    description: 'Bidirectional vocabulary cards for quick recall.',
    helper: 'Practice A -> B and B -> A without creating two cards.',
    available: true
  },
  {
    id: 'definition',
    label: 'Concept definition',
    description: 'Term, definition, and a short example.',
    helper: 'Coming soon.',
    available: false
  },
  {
    id: 'quote',
    label: 'Quote and source',
    description: 'Keep citations and sources together.',
    helper: 'Coming soon.',
    available: false
  },
  {
    id: 'process',
    label: 'Process steps',
    description: 'Procedures, checklists, and sequences.',
    helper: 'Coming soon.',
    available: false
  }
];

export const MOCK_INDEX_CARDS: IndexCard[] = [
  {
    id: 'vocab-1',
    type: 'vocab-bidi',
    sideA: 'gratia',
    sideB: 'grace',
    sideALabel: 'Latin',
    sideBLabel: 'English',
    tags: ['latin', 'theology', 'core'],
    note: 'Central concept for many liturgical texts.',
    createdAt: '2024-07-04',
    lastReviewed: '2 days ago'
  },
  {
    id: 'vocab-2',
    type: 'vocab-bidi',
    sideA: 'pax',
    sideB: 'peace',
    sideALabel: 'Latin',
    sideBLabel: 'English',
    tags: ['latin', 'liturgy', 'greeting'],
    note: 'Used in the sign of peace.',
    createdAt: '2024-06-28',
    lastReviewed: 'yesterday'
  },
  {
    id: 'vocab-3',
    type: 'vocab-bidi',
    sideA: 'communio',
    sideB: 'communion',
    sideALabel: 'Latin',
    sideBLabel: 'English',
    tags: ['latin', 'sacrament', 'core'],
    note: 'Appears in prayers and chants.',
    createdAt: '2024-06-12',
    lastReviewed: 'last week'
  },
  {
    id: 'vocab-4',
    type: 'vocab-bidi',
    sideA: 'agape',
    sideB: 'self-giving love',
    sideALabel: 'Greek',
    sideBLabel: 'English',
    tags: ['greek', 'virtue', 'theology'],
    note: 'Often paired with philia and eros.',
    createdAt: '2024-05-16',
    lastReviewed: '3 weeks ago'
  },
  {
    id: 'vocab-5',
    type: 'vocab-bidi',
    sideA: 'credo',
    sideB: 'I believe',
    sideALabel: 'Latin',
    sideBLabel: 'English',
    tags: ['latin', 'creed', 'prayer'],
    note: 'First word of the Nicene Creed.',
    createdAt: '2024-04-02',
    lastReviewed: 'last month'
  }
];
