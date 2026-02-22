import type { Copy } from '../../../content/types';
import type { CogitaConnectionType, CogitaInfoType } from './types';

export const getInfoTypeLabel = (copy: Copy, type: CogitaInfoType | 'any' | 'vocab') => {
  const labels = copy.cogita.library.infoTypes;
  const connection = copy.cogita.library.connectionTypes;
  const groups = copy.cogita.library.groupTypes;
  const map: Record<string, string> = {
    any: labels.any,
    vocab: labels.vocab,
    book: groups.book,
    citation: groups.citation,
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
    computed: labels.computed,
    'word-language': connection.wordLanguage,
    'citation-language': connection.citationLanguage,
    'language-sentence': connection.languageSentence,
    translation: connection.translation,
    'word-topic': connection.wordTopic,
    reference: connection.reference,
    'source-resource': connection.sourceResource,
    'work-contributor': connection.workContributor,
    'work-medium': connection.workMedium,
    'orcid-link': connection.orcidLink
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
  { value: 'citation', label: getInfoTypeLabel(copy, 'citation') },
  { value: 'computed', label: getInfoTypeLabel(copy, 'computed') },
  { value: 'vocab', label: getInfoTypeLabel(copy, 'vocab') },
  { value: 'book', label: getInfoTypeLabel(copy, 'book') },
  { value: 'word-language', label: getInfoTypeLabel(copy, 'word-language') },
  { value: 'citation-language', label: getInfoTypeLabel(copy, 'citation-language') },
  { value: 'language-sentence', label: getInfoTypeLabel(copy, 'language-sentence') },
  { value: 'translation', label: getInfoTypeLabel(copy, 'translation') },
  { value: 'word-topic', label: getInfoTypeLabel(copy, 'word-topic') },
  { value: 'reference', label: getInfoTypeLabel(copy, 'reference') },
  { value: 'source-resource', label: getInfoTypeLabel(copy, 'source-resource') },
  { value: 'work-contributor', label: getInfoTypeLabel(copy, 'work-contributor') },
  { value: 'work-medium', label: getInfoTypeLabel(copy, 'work-medium') },
  { value: 'orcid-link', label: getInfoTypeLabel(copy, 'orcid-link') }
];

export const getConnectionTypeOptions = (copy: Copy): Array<{ value: CogitaConnectionType; label: string }> => [
  { value: 'word-language', label: copy.cogita.library.connectionTypes.wordLanguage },
  { value: 'citation-language', label: copy.cogita.library.connectionTypes.citationLanguage },
  { value: 'word-topic', label: copy.cogita.library.connectionTypes.wordTopic },
  { value: 'language-sentence', label: copy.cogita.library.connectionTypes.languageSentence },
  { value: 'translation', label: copy.cogita.library.connectionTypes.translation },
  { value: 'reference', label: copy.cogita.library.connectionTypes.reference },
  { value: 'source-resource', label: copy.cogita.library.connectionTypes.sourceResource },
  { value: 'work-contributor', label: copy.cogita.library.connectionTypes.workContributor },
  { value: 'work-medium', label: copy.cogita.library.connectionTypes.workMedium },
  { value: 'orcid-link', label: copy.cogita.library.connectionTypes.orcidLink }
];

export const getCardSearchOptions = (copy: Copy): Array<{ value: CogitaInfoType | 'any' | 'vocab'; label: string }> => [
  { value: 'any', label: getInfoTypeLabel(copy, 'any') },
  { value: 'vocab', label: getInfoTypeLabel(copy, 'vocab') },
  ...getInfoTypeOptions(copy).filter((option) => option.value !== 'any')
];
