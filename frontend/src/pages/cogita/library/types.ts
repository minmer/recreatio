export type CogitaInfoType =
  | 'language'
  | 'word'
  | 'sentence'
  | 'topic'
  | 'collection'
  | 'person'
  | 'institution'
  | 'collective'
  | 'orcid'
  | 'address'
  | 'email'
  | 'phone'
  | 'media'
  | 'work'
  | 'geo'
  | 'music_piece'
  | 'music_fragment'
  | 'source'
  | 'question'
  | 'computed'
  | 'citation'
  | 'vocab'
  | 'book'
  | 'word-language'
  | 'citation-language'
  | 'language-sentence'
  | 'translation'
  | 'word-topic'
  | 'reference'
  | 'source-resource'
  | 'work-contributor'
  | 'work-medium'
  | 'orcid-link';

export type CogitaConnectionType =
  | 'word-language'
  | 'citation-language'
  | 'language-sentence'
  | 'translation'
  | 'word-topic'
  | 'reference'
  | 'source-resource'
  | 'work-contributor'
  | 'work-medium'
  | 'orcid-link';

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
