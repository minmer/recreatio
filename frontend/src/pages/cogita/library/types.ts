export type CogitaInfoType =
  | 'language'
  | 'word'
  | 'sentence'
  | 'topic'
  | 'collection'
  | 'person'
  | 'address'
  | 'email'
  | 'phone'
  | 'book'
  | 'media'
  | 'geo'
  | 'music_piece'
  | 'music_fragment'
  | 'source'
  | 'reference'
  | 'quote'
  | 'computed';

export type CogitaConnectionType =
  | 'word-language'
  | 'quote-language'
  | 'language-sentence'
  | 'translation'
  | 'word-topic'
  | 'reference';

export type CogitaGroupType = 'vocab' | 'citation';

export type CogitaLibraryMode = 'detail' | 'collection' | 'list';

export type CogitaSearchScope = {
  label: string;
  infoType: CogitaInfoType | 'any';
};

export type CogitaInfoOption = {
  id: string;
  label: string;
  infoType: CogitaInfoType;
};

export type CogitaInfoForm = {
  infoType: CogitaInfoType;
  label: string;
  payload: Record<string, string>;
};

export type CogitaConnectionForm = {
  connectionType: CogitaConnectionType;
  language: CogitaInfoOption | null;
  word: CogitaInfoOption | null;
  wordA: CogitaInfoOption | null;
  wordB: CogitaInfoOption | null;
  sentence: CogitaInfoOption | null;
  topic: CogitaInfoOption | null;
  payload: Record<string, string>;
};

export type CogitaGroupForm = {
  groupType: CogitaGroupType;
  languageA: CogitaInfoOption | null;
  wordA: CogitaInfoOption | null;
  languageB: CogitaInfoOption | null;
  wordB: CogitaInfoOption | null;
  wordATags: CogitaInfoOption[];
  wordBTags: CogitaInfoOption[];
  translationTags: CogitaInfoOption[];
};
