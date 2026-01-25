export type CogitaInfoType =
  | 'language'
  | 'word'
  | 'sentence'
  | 'topic'
  | 'person'
  | 'address'
  | 'email'
  | 'phone'
  | 'book'
  | 'media'
  | 'geo'
  | 'music_piece'
  | 'music_fragment';

export type CogitaConnectionType = 'word-language' | 'language-sentence' | 'translation';

export type CogitaGroupType = 'vocab';

export type CogitaLibraryMode = 'detail' | 'collection' | 'list';

export type CogitaSearchScope = {
  label: string;
  infoType: CogitaInfoType | 'any';
};

export type CogitaInfoForm = {
  infoType: CogitaInfoType;
  label: string;
  payload: Record<string, string>;
};

export type CogitaConnectionForm = {
  connectionType: CogitaConnectionType;
  infoIds: string[];
  payload: Record<string, string>;
};

export type CogitaGroupForm = {
  groupType: CogitaGroupType;
  infoItems: Array<{ infoType: CogitaInfoType; payload: Record<string, string> }>;
  connections: Array<{ connectionType: CogitaConnectionType; infoIds: string[] }>;
};
