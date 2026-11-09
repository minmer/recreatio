/** Reuse Library encryption and its atomic optimistic-concurrency batch, including the import receipt. */
import { newId } from '../../core/ids';
import { WorkspaceError } from '../../core/session';
import type { LibraryStore, SaveInput } from '../libraryStore';
import { KIND, type LitEntity } from './schema';
import { canonicalJson, dependencies, entitiesOf, planImport, type ImportPlan } from './resources';
import { effectiveEntities } from './defaults';

const bytes = new TextEncoder();
export async function checksum(value: unknown): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.encode(canonicalJson(value))))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function entryIdFor(library: string, canonicalId: string): Promise<string> {
  const hash = await checksum(['recreatio.liturgy', library, canonicalId]);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export const exportEntities = (entities: readonly LitEntity[], provenance?: string) => ({ format: 'recreatio.liturgy', schema_version: '1.1', ...(provenance ? { provenance } : {}), entities });
export const storeStamp = (store: LibraryStore): string => canonicalJson(store.all().map(e => [e.id, e.version]).sort(([a], [b]) => String(a).localeCompare(String(b))));
export async function commitImport(store: LibraryStore, raw: unknown, preview: ImportPlan, mode: 'add' | 'update', allowApproved: boolean, stamp: string, areaPublic = false): Promise<number> {
  await store.sync();
  if (storeStamp(store) !== stamp) throw new WorkspaceError('liturgy.errors.stale'); // i18n-ignore — machine-readable error code, translated by the import UI.
  const own = entitiesOf(store.all());
  const plan = planImport(raw, effectiveEntities(own), mode, allowApproved, own);
  if (canonicalJson(plan) !== canonicalJson(preview) || plan.problems.length > 0) throw new WorkspaceError('liturgy.errors.stale'); // i18n-ignore — machine-readable error code, translated by the import UI.
  const changes = [...plan.create, ...plan.update.map(p => p.after)];
  const gone = [...plan.remove, ...plan.reset.map(p => p.before)];
  const changedIds = new Set([...changes, ...gone].map(e => e.id));
  if (changedIds.size === 0) return 0;
  const all = effectiveEntities([...own.filter(e => !changedIds.has(e.id)), ...changes]);
  if (areaPublic && all.some(e => e.entity_type === 'text_edition' && !e.permitted_usage.includes('share'))) throw new WorkspaceError('liturgy.errors.private_edition'); // i18n-ignore — machine-readable error code, translated by the import UI.
  const stored = new Map(store.all().filter(row => Object.values(KIND).includes(row.kind)).map(row => [String(row.data.id), row]));
  const ids = new Map<string, string>();
  for (const e of all) ids.set(e.id, stored.get(e.id)?.id ?? await entryIdFor(store.libraryId, e.id));
  const at = new Date().toISOString(), receiptId = newId();
  const records: SaveInput[] = [];
  const history = [];
  for (const e of changes) {
    const entryId = ids.get(e.id)!;
    const old = store.own(entryId), hash = await checksum(e);
    records.push({ id: entryId, kind: KIND[e.entity_type], key: old?.key ?? e.id, data: { ...e,
      _refs: [...dependencies(e).flatMap(id => ids.get(id) ? [ids.get(id)!] : []), ...('library_entry_id' in e && e.library_entry_id ? [e.library_entry_id] : [])],
      _import: { receipt: receiptId, at, checksum: hash, provenance: plan.provenance } } });
    history.push({ action: old ? 'update' : 'create', entryId, canonicalId: e.id, beforeVersion: old?.version ?? 0, afterVersion: (old?.version ?? 0) + 1, checksum: hash });
  }
  const remove: string[] = [];
  for (const e of gone) {
    const old = stored.get(e.id);
    if (!old) throw new WorkspaceError('liturgy.errors.stale'); // i18n-ignore — translated machine-readable error code.
    const reset = plan.reset.some(r => r.before.id === e.id);
    // A reset marker is not canonical content. Keeping its UUID/version allows a later override without resurrecting a deleted row.
    if (reset) records.push({ id: old.id, kind: 'lit_default_reset', data: { id: e.id, _import: { receipt: receiptId, at, provenance: plan.provenance } } });
    else remove.push(old.id);
    history.push({ action: reset ? 'reset_default' : 'remove', entryId: old.id, canonicalId: e.id, beforeVersion: old.version, afterVersion: old.version + 1, checksum: await checksum(e) });
  }
  records.push({ id: receiptId, kind: 'lit_import', data: { title: at, at, mode: plan.mode, provenance: plan.provenance, records: history } });
  await store.saveAll(records, undefined, remove);
  return changedIds.size;
}
