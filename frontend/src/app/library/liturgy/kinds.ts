/** Library/Cogita adapters. Derived text is computed for readers, never written as another canonical copy. */
import type { LibEntry, LibKind } from '../libraryKinds';
import { t } from '../../core/i18n';
import { KIND, type LitEntity } from './schema';
import { entitiesOf, indexOf, resolveText } from './resources';

export const LITURGY_KINDS: readonly LibKind[] = Object.entries(KIND).map(([type, kind]) => ({
  kind, get label() { return t(`liturgy.types.${type}`); }, get plural() { return t(`liturgy.types.${type}`); },
  get says() { return t('liturgy.normalized'); }, keyed: true,
  fields: [
    { key: 'title', get label() { return t('liturgy.title'); }, type: 'line' },
    { key: 'id', get label() { return t('liturgy.identifier'); }, type: 'line' },
    { key: 'language', get label() { return t('liturgy.language'); }, type: 'line' },
    { key: 'resource_type', get label() { return t('liturgy.type'); }, type: 'line' },
    { key: 'text', get label() { return t('liturgy.text'); }, type: 'text' },
    { key: 'references', get label() { return t('liturgy.references'); }, type: 'refs', to: Object.values(KIND) }
  ],
  title: data => typeof data.title === 'string' ? data.title : String(data.id ?? kind),
  sort: e => String(e.data.title ?? e.data.id ?? ''), example: { data: { title: type } }
}));
export function projectLiturgyEntries(entries: readonly LibEntry[]): LibEntry[] {
  const index = indexOf(entitiesOf(entries));
  return entries.map(e => {
    if (!Object.values(KIND).includes(e.kind)) return e;
    const resolved = resolveText(String(e.data.id), index);
    return { ...e, data: { ...e.data, references: e.data._refs ?? [], ...(resolved ? { text: resolved.blocks.map(b => `${b.verse === undefined ? '' : `${b.verse}. `}${b.text}`).join('\n') } : {}) } };
  });
}
export const asData = (entity: LitEntity): Record<string, unknown> => ({ ...entity });
