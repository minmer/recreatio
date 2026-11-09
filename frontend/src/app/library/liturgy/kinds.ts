/**
 * Die Arten der Liturgia für die Bibliothek und Cogita. Ohne zod: `libraryKinds.ts` (erstes Bündel) liest diese Datei;
 * die errechneten Texte für Leser kommen aus `projection.ts`.
 */
import type { LibKind } from '../libraryKinds';
import { t } from '../../core/i18n';
import { KIND } from './names';

export const LITURGY_KINDS: readonly LibKind[] = Object.entries(KIND).map(([type, kind]) => ({
  kind, get label() { return t(`liturgy.types.${type}`); }, get plural() { return t(`liturgy.types.${type}`); },
  get says() { return t('liturgy.normalized'); }, keyed: true,
  fields: [
    { key: 'title', get label() { return t('liturgy.title'); }, type: 'line', says: '' },
    { key: 'id', get label() { return t('liturgy.identifier'); }, type: 'line', says: '' },
    { key: 'language', get label() { return t('liturgy.language'); }, type: 'line', says: '' },
    { key: 'resource_type', get label() { return t('liturgy.type'); }, type: 'line', says: '' },
    { key: 'text', get label() { return t('liturgy.text'); }, type: 'text', says: '' },
    { key: 'references', get label() { return t('liturgy.references'); }, type: 'refs', says: '', to: Object.values(KIND) }
  ],
  title: data => typeof data.title === 'string' ? data.title : String(data.id ?? kind),
  sort: e => String(e.data.title ?? e.data.id ?? ''), example: { data: { title: type } }
}));
