import type { CogitaConnectionType, CogitaGroupType, CogitaInfoType } from './types';

export const infoTypeOptions: Array<{ value: CogitaInfoType | 'any'; label: string }> = [
  { value: 'any', label: 'All info types' },
  { value: 'language', label: 'Language' },
  { value: 'word', label: 'Word' },
  { value: 'sentence', label: 'Sentence / citation' },
  { value: 'topic', label: 'Topic' },
  { value: 'person', label: 'Person' },
  { value: 'address', label: 'Address' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'book', label: 'Book' },
  { value: 'media', label: 'Media' },
  { value: 'geo', label: 'Geo' },
  { value: 'music_piece', label: 'Music piece' },
  { value: 'music_fragment', label: 'Music fragment' }
];

export const connectionTypeOptions: Array<{ value: CogitaConnectionType; label: string }> = [
  { value: 'word-language', label: 'Word - language' },
  { value: 'language-sentence', label: 'Language - sentence' },
  { value: 'translation', label: 'Translation link' }
];

export const groupTypeOptions: Array<{ value: CogitaGroupType; label: string }> = [
  { value: 'vocab', label: 'Vocabulary card' }
];

export const cardSearchOptions: Array<{ value: CogitaInfoType | 'any' | 'vocab'; label: string }> = [
  { value: 'any', label: 'All index cards' },
  { value: 'vocab', label: 'Vocabulary card' },
  ...infoTypeOptions.filter((option) => option.value !== 'any')
];
