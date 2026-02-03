import type { Copy } from '../../../content/types';
import type { CogitaConnectionType, CogitaGroupType, CogitaInfoType } from './types';

export const getInfoTypeLabel = (copy: Copy, type: CogitaInfoType | 'any' | 'vocab') => {
  const labels = copy.cogita.library.infoTypes;
  const map: Record<string, string> = {
    any: labels.any,
    vocab: labels.vocab,
    language: labels.language,
    word: labels.word,
    sentence: labels.sentence,
    topic: labels.topic,
    collection: labels.collection,
    person: labels.person,
    institution: labels.institution,
    collective: labels.collective,
    orcid: labels.orcid,
    address: labels.address,
    email: labels.email,
    phone: labels.phone,
    media: labels.media,
    work: labels.work,
    geo: labels.geo,
    music_piece: labels.musicPiece,
    music_fragment: labels.musicFragment,
    source: labels.source,
    quote: labels.quote,
    computed: labels.computed
  };
  return map[type] ?? String(type);
};

export const getInfoTypeOptions = (copy: Copy): Array<{ value: CogitaInfoType | 'any'; label: string }> => [
  { value: 'any', label: getInfoTypeLabel(copy, 'any') },
  { value: 'language', label: getInfoTypeLabel(copy, 'language') },
  { value: 'word', label: getInfoTypeLabel(copy, 'word') },
  { value: 'sentence', label: getInfoTypeLabel(copy, 'sentence') },
  { value: 'topic', label: getInfoTypeLabel(copy, 'topic') },
  { value: 'collection', label: getInfoTypeLabel(copy, 'collection') },
  { value: 'person', label: getInfoTypeLabel(copy, 'person') },
  { value: 'institution', label: getInfoTypeLabel(copy, 'institution') },
  { value: 'collective', label: getInfoTypeLabel(copy, 'collective') },
  { value: 'orcid', label: getInfoTypeLabel(copy, 'orcid') },
  { value: 'address', label: getInfoTypeLabel(copy, 'address') },
  { value: 'email', label: getInfoTypeLabel(copy, 'email') },
  { value: 'phone', label: getInfoTypeLabel(copy, 'phone') },
  { value: 'media', label: getInfoTypeLabel(copy, 'media') },
  { value: 'work', label: getInfoTypeLabel(copy, 'work') },
  { value: 'geo', label: getInfoTypeLabel(copy, 'geo') },
  { value: 'music_piece', label: getInfoTypeLabel(copy, 'music_piece') },
  { value: 'music_fragment', label: getInfoTypeLabel(copy, 'music_fragment') },
  { value: 'source', label: getInfoTypeLabel(copy, 'source') },
  { value: 'quote', label: getInfoTypeLabel(copy, 'quote') },
  { value: 'computed', label: getInfoTypeLabel(copy, 'computed') }
];

export const getConnectionTypeOptions = (copy: Copy): Array<{ value: CogitaConnectionType; label: string }> => [
  { value: 'word-language', label: copy.cogita.library.connectionTypes.wordLanguage },
  { value: 'quote-language', label: copy.cogita.library.connectionTypes.quoteLanguage },
  { value: 'word-topic', label: copy.cogita.library.connectionTypes.wordTopic },
  { value: 'language-sentence', label: copy.cogita.library.connectionTypes.languageSentence },
  { value: 'translation', label: copy.cogita.library.connectionTypes.translation },
  { value: 'reference', label: copy.cogita.library.connectionTypes.reference },
  { value: 'source-resource', label: copy.cogita.library.connectionTypes.sourceResource },
  { value: 'work-contributor', label: copy.cogita.library.connectionTypes.workContributor },
  { value: 'work-medium', label: copy.cogita.library.connectionTypes.workMedium },
  { value: 'orcid-link', label: copy.cogita.library.connectionTypes.orcidLink }
];

export const getGroupTypeOptions = (copy: Copy): Array<{ value: CogitaGroupType; label: string }> => [
  { value: 'vocab', label: copy.cogita.library.groupTypes.vocab },
  { value: 'citation', label: copy.cogita.library.groupTypes.citation },
  { value: 'book', label: copy.cogita.library.groupTypes.book }
];

export const getCardSearchOptions = (copy: Copy): Array<{ value: CogitaInfoType | 'any' | 'vocab'; label: string }> => [
  { value: 'any', label: getInfoTypeLabel(copy, 'any') },
  { value: 'vocab', label: getInfoTypeLabel(copy, 'vocab') },
  ...getInfoTypeOptions(copy).filter((option) => option.value !== 'any')
];
