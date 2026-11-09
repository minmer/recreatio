import { useMemo, useState } from 'react';
import { loadVersions, type VersionRow } from '../../cogita/versions';
import type { Me } from '../../core/me';
import { useT } from '../../core/i18n';
import { viewPath } from '../../routes';
import { Loading } from '../../ui/Loading';
import { type OpenLibrary } from '../library';
import { useLibraryStore, type Entry, type LibraryStore } from '../libraryStore';
import { DEFAULT_CONTEXT, HOURS, KIND, type CalendarContext, type Hour, type LitEntity, type TextBlock } from './schema';
import { dependencies, entitiesOf, indexOf, resolveText, allUsageOf } from './resources';
import { effectiveEntities } from './defaults';
import { calendarRange, isDate, PRECEDENCE, resolveLiturgicalDay, todayIn } from './calendar';
import { composeAllHours, composeOffice, type Composition } from './compose';
import { ImportPanel } from './ImportPanel';
import { download, offlineDocument, openPrint, printDocument } from './export';
import { exportEntities } from './persistence';
import './liturgy.css';

const TABS = ['resources', 'calendar', 'import', 'history'] as const;
export function LiturgyHome({ me, library, trail }: { me: Me; library: OpenLibrary; trail: readonly string[] }) {
  const { store, revision, failed } = useLibraryStore(me.ring, library);
  const t = useT();
  const own = useMemo(() => entitiesOf(store?.all() ?? []), [store, revision]);
  const entities = useMemo(() => effectiveEntities(own), [own]);
  if (!store || !store.loaded) return failed ? <p className="wk-error">{failed}</p> : <Loading label={t('common.loading')} />;
  const first = trail[0] ?? 'resources';
  const resourceId = first === 'resource' ? trail[1] : TABS.includes(first as typeof TABS[number]) ? undefined : first;
  const row = resourceId ? store.own(resourceId) : undefined;
  const selected = resourceId ? entities.find(e => e.id === row?.data.id || e.id === resourceId) : undefined;
  const tab = TABS.includes(first as typeof TABS[number]) ? first : 'resources';
  return <section className="lit-home">
    <p className="lit-eyebrow"><a href={viewPath('library')}>{t('library.list.title')}</a> / {t('liturgy.name')}</p>
    <h1 className="wk-h1">{library.name}</h1><p className="wk-lede">{t('liturgy.lede')}</p>
    {failed && <p className="wk-note">{t('liturgy.cached')}</p>}
    <nav className="wk-tabs" aria-label={t('liturgy.sections')}>{TABS.map(name => <a key={name} className={`wk-tab${!selected && tab === name ? ' wk-tab-on' : ''}`} href={viewPath('library', library.libraryId, name)}>{t(`liturgy.tabs.${name}`)}</a>)}</nav>
    <div className="wk-panel">
      {selected ? <ResourceDetail key={selected.id} entity={selected} entities={entities} store={store} library={library} />
        : tab === 'calendar' ? <CalendarReader entities={entities} libraryId={library.libraryId} />
        : tab === 'import' ? <ImportPanel store={store} library={library} />
        : tab === 'history' ? <ImportHistory store={store} library={library} />
        : <ResourceList own={own} entities={entities} library={library} />}
    </div>
  </section>;
}
function ResourceList({ own, entities, library }: { own: LitEntity[]; entities: LitEntity[]; library: OpenLibrary }) {
  const t = useT(), [query, setQuery] = useState(''), [type, setType] = useState(''), [builtins, setBuiltins] = useState(false), [limit, setLimit] = useState(50);
  const found = (builtins ? entities : own).filter(e => (!type || e.entity_type === type) && `${e.title} ${e.id} ${'language' in e ? e.language : ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <div className="lit-controls">
      <label className="wk-field"><span>{t('liturgy.search')}</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }} /></label>
      <label className="wk-field"><span>{t('liturgy.type')}</span><select value={type} onChange={e => { setType(e.target.value); setLimit(50); }}><option value="">{t('liturgy.allTypes')}</option>{Object.keys(KIND).map(k => <option key={k} value={k}>{t(`liturgy.types.${k}`)}</option>)}</select></label>
    </div>
    <label className="lit-check"><input type="checkbox" checked={builtins} onChange={e => setBuiltins(e.target.checked)} />{t('liturgy.showDefaults')}</label>
    <p className="lit-meta">{t('liturgy.count', { count: found.length })}</p>
    {found.length === 0 && <div className="lit-empty"><h2>{t('liturgy.empty')}</h2><p>{t('liturgy.emptyHint')}</p>{library.writes && <a className="wk-btn" href={viewPath('library', library.libraryId, 'import')}>{t('liturgy.importTitle')}</a>}</div>}
    <ul className="lit-resources">{found.slice(0, limit).map(e => <li key={e.id}><a href={viewPath('library', library.libraryId, 'resource', e.id)}><strong>{e.title}</strong><span>{t(`liturgy.types.${e.entity_type}`)} · {e.id}</span></a><span className={`lit-badge is-${e.status}`}>{t(`liturgy.status.${e.status}`)}</span></li>)}</ul>
    {found.length > limit && <button className="wk-btn wk-btn-quiet" onClick={() => setLimit(n => n + 50)}>{t('liturgy.more')}</button>}
    <aside className="lit-connect"><h2 className="wk-h2">{t('liturgy.cogita')}</h2><p>{t('liturgy.cogitaHint')}</p><a href={viewPath('knowledge')}>{t('liturgy.openCogita')} →</a></aside>
    {own.length > 0 && <div className="wk-actions"><button className="wk-btn wk-btn-quiet" onClick={() => download('liturgy-offline.html', offlineDocument(library.name, own), 'text/html')}>{t('liturgy.offline')}</button><button className="wk-btn wk-btn-quiet" onClick={() => download('liturgy.json', JSON.stringify(exportEntities(own), null, 2))}>{t('liturgy.exportJson')}</button></div>}
  </>;
}
export function TextBlocks({ blocks }: { blocks: readonly TextBlock[] }) {
  return <>{blocks.map((b, i) => <p key={i} className={`lit-block is-${b.type}${b.emphasis ? ` is-${b.emphasis}` : ''}`}>{b.verse !== undefined && <sup>{b.verse} </sup>}{b.speaker && <strong>{b.speaker} </strong>}{b.text}</p>)}</>;
}
function ResourceDetail({ entity, entities, store, library }: { entity: LitEntity; entities: LitEntity[]; store: LibraryStore; library: OpenLibrary }) {
  const t = useT(), [edit, setEdit] = useState<LitEntity | null>(null), [versions, setVersions] = useState<readonly VersionRow[] | null>(null), [failed, setFailed] = useState('');
  const index = indexOf(entities), resolved = resolveText(entity.id, index), uses = allUsageOf(entity.id, entities);
  const stored = store.all().find(e => e.data.id === entity.id && Object.values(KIND).includes(e.kind));
  const link = (id: string) => <a href={viewPath('library', library.libraryId, 'resource', id)}>{index.get(id)?.title ?? id}</a>;
  const edition = resolved ? index.get(resolved.resource.edition_id) : undefined;
  return <>
    <a href={viewPath('library', library.libraryId)}>{t('liturgy.back')}</a><h2>{entity.title}</h2>
    <p className="lit-meta">{t(`liturgy.types.${entity.entity_type}`)} · <code>{entity.id}</code> · {t('liturgy.revision', { revision: entity.revision })} · {t(`liturgy.status.${entity.status}`)}</p>
    {edition?.entity_type === 'text_edition' && <p className="wk-note">{link(edition.id)} · {edition.language} · {edition.license} · {edition.copyright_holder}</p>}
    {entity.entity_type === 'canonical_work' && entity.numbering_systems && <dl className="lit-facts">{Object.entries(entity.numbering_systems).map(([system, number]) => <div key={system}><dt>{system}</dt><dd>{Array.isArray(number) ? number.join(', ') : number}</dd></div>)}</dl>}
    {resolved && <article className="lit-reading"><TextBlocks blocks={resolved.blocks} /></article>}
    {entity.entity_type === 'passage_definition' && <p>{t('liturgy.passageHint')} {link(resolved?.resource.id ?? entity.resource_id ?? entity.work_id)}</p>}
    {entity.source_reference && <p className="lit-meta">{entity.source_reference}</p>}
    {'library_entry_id' in entity && entity.library_entry_id && <p><a href={store.get(entity.library_entry_id) ? viewPath('library', (store.get(entity.library_entry_id) as Entry).libraryId, entity.library_entry_id) : viewPath('library')}>{t('liturgy.librarySource')}</a></p>}
    <h3>{t('liturgy.references')}</h3><ul>{dependencies(entity).map(id => <li key={id}>{link(id)}</li>)}</ul>
    <h3>{t('liturgy.usedBy', { count: uses.length })}</h3><ul>{uses.map(e => <li key={e.id}>{link(e.id)} · {t(`liturgy.types.${e.entity_type}`)}</li>)}</ul>
    <details><summary>{t('liturgy.metadata')}</summary><pre className="lit-json">{JSON.stringify(entity, null, 2)}</pre></details>
    <div className="wk-actions"><button className="wk-btn wk-btn-quiet" onClick={() => download(`${entity.id}.json`, JSON.stringify(exportEntities([entity]), null, 2))}>{t('liturgy.exportJson')}</button>{library.writes && <button className="wk-btn" onClick={() => setEdit({ ...entity })}>{t('liturgy.edit')}</button>}{stored && library.writes && <button className="wk-btn wk-btn-quiet" onClick={async () => { try { setVersions((await loadVersions(store.libraryId, stored.id)).versions); } catch (e) { setFailed(e instanceof Error ? e.message : t('common.failed')); } }}>{t('liturgy.revisions')}</button>}</div>
    {failed && <p className="wk-error">{failed}</p>}
    {versions && <ul>{versions.map(v => <li key={v.version}>{v.writtenAt} · {t('liturgy.revision', { revision: v.version })}<button className="wk-link-btn" onClick={async () => { if (!stored) return; try { const doc = await store.version(stored.id, v); const old = doc && entitiesOf([doc])[0]; if (!old) throw new Error(t('common.failed')); setEdit({ ...old, revision: entity.revision }); } catch (e) { setFailed(e instanceof Error ? e.message : t('common.failed')); } }}>{t('liturgy.restorePreview')}</button></li>)}{versions.length === 0 && <li>{t('liturgy.noHistory')}</li>}</ul>}
    {edit && <ImportPanel key={JSON.stringify(edit)} store={store} library={library} initial={edit} />}
  </>;
}
export function CalendarReader({ entities, libraryId }: { entities: readonly LitEntity[]; libraryId: string }) {
  const t = useT();
  const [date, setDate] = useState(() => todayIn(DEFAULT_CONTEXT.time_zone)), [until, setUntil] = useState(date), [hour, setHour] = useState<Hour | 'all'>('lauds');
  const [profile, setProfile] = useState(''), [optional, setOptional] = useState(''), [psalmody, setPsalmody] = useState<'current' | 'complementary'>('current');
  const [paper, setPaper] = useState<'A4' | 'A5'>('A4'), [details, setDetails] = useState(false), [error, setError] = useState('');
  const profiles = entities.filter(e => e.entity_type === 'calendar_profile');
  const chosen = profiles.find(e => e.id === profile);
  const context: CalendarContext = { ...(chosen?.entity_type === 'calendar_profile' ? chosen : DEFAULT_CONTEXT), ...(optional ? { optional_observance: optional } : {}) };
  const valid = isDate(date) && Number(date.slice(0, 4)) >= 1583 && Number(date.slice(0, 4)) <= 4099;
  const day = valid ? resolveLiturgicalDay(date, context, entities) : null;
  const compositions = valid ? hour === 'all' ? composeAllHours(date, context, entities) : [composeOffice(date, hour, context, entities, { psalmody })] : [];
  return <>
    <div className="lit-controls">
      <label className="wk-field"><span>{t('liturgy.date')}</span><input type="date" value={date} min="1583-01-01" max="4099-12-31" onChange={e => { setDate(e.target.value); setUntil(e.target.value); setOptional(''); }} /></label>
      <label className="wk-field"><span>{t('liturgy.profile')}</span><select value={profile} onChange={e => { setProfile(e.target.value); setOptional(''); }}><option value="">{t('liturgy.poland')}</option>{profiles.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label className="wk-field"><span>{t('liturgy.hour')}</span><select value={hour} onChange={e => setHour(e.target.value as Hour | 'all')}><option value="all">{t('liturgy.allHours')}</option>{HOURS.map(h => <option key={h} value={h}>{t(`liturgy.hours.${h}`)}</option>)}</select></label>
    </div>
    {!valid && <p className="wk-error">{t('liturgy.errors.invalid_date')}</p>}
    {day && <>
      <div className={`lit-day color-${day.selected.color}`}><h2>{day.selected.title}</h2><dl className="lit-facts">
        <div><dt>{t('liturgy.season')}</dt><dd>{t(`liturgy.seasons.${day.season}`)} · {day.week}</dd></div>
        <div><dt>{t('liturgy.psalter')}</dt><dd>{day.psalterWeek ?? t('liturgy.properPsalter')}</dd></div>
        <div><dt>{t('liturgy.cycles')}</dt><dd>{day.sundayCycle} / {day.weekdayCycle}</dd></div>
        <div><dt>{t('liturgy.year')}</dt><dd>{day.liturgicalYear}</dd></div>
        <div><dt>{t('liturgy.rank')}</dt><dd>{day.selected.precedence} · {t(`liturgy.precedence.${day.selected.precedence}`)}</dd></div>
      </dl></div>
      {(day.optional.length > 0 || day.commemorations.length > 0) && <label className="wk-field"><span>{t('liturgy.optional')}</span><select value={optional} onChange={e => setOptional(e.target.value)}><option value="">{t('liturgy.ofDay')}</option>{[...day.optional, ...day.commemorations].map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
      {(['terce', 'sext', 'none'] as string[]).includes(hour) && <label className="wk-field"><span>{t('liturgy.psalmody')}</span><select value={psalmody} onChange={e => setPsalmody(e.target.value as 'current' | 'complementary')}><option value="current">{t('liturgy.currentPsalms')}</option><option value="complementary">{t('liturgy.complementaryPsalms')}</option></select></label>}
      <label className="lit-check"><input type="checkbox" checked={details} onChange={e => setDetails(e.target.checked)} />{t('liturgy.diagnostics')}</label>
      {day.diagnostics.length > 0 && <p className="wk-note">{t('liturgy.calendarPartial')}</p>}
      {details && <div className="lit-preview"><h3>{t('liturgy.decisions')}</h3><ul>{day.candidates.map(c => <li key={c.id}>{c.title} · {c.precedence} · {c.scope}{c.from ? ` ← ${c.from}` : ''}{c.rule ? ` · ${c.rule}` : ''}</li>)}</ul>{day.transferred.length > 0 && <p>{t('liturgy.transferred')}: {day.transferred.map(c => c.title).join('; ')}</p>}{day.omitted.length > 0 && <p>{t('liturgy.omitted')}: {day.omitted.map(c => c.title).join('; ')}</p>}<details><summary>{t('liturgy.precedenceTable')}</summary><ol>{PRECEDENCE.map(p => <li key={p.level}>{t(p.label)}</li>)}</ol></details></div>}
      <div className="lit-controls lit-export">
        <label className="wk-field"><span>{t('liturgy.until')}</span><input type="date" value={until} min={date} onChange={e => setUntil(e.target.value)} /></label>
        <label className="wk-field"><span>{t('liturgy.paper')}</span><select value={paper} onChange={e => setPaper(e.target.value as 'A4' | 'A5')}><option>A4</option><option>A5</option></select></label>
        <button className="wk-btn wk-btn-quiet" onClick={() => { try {
          const days = calendarRange(date, until, context, entities);
          const docs = days.flatMap(d => hour === 'all' ? composeAllHours(d.date, context, entities) : [composeOffice(d.date, hour, context, entities, { psalmody })]);
          const editions = new Set(docs.flatMap(c => c.slots.flatMap(s => [...(s.editionId ? [s.editionId] : []), ...(s.antiphon ? [s.antiphon.editionId] : [])])));
          if (entities.some(e => e.entity_type === 'text_edition' && editions.has(e.id) && !e.permitted_usage.includes('print'))) { setError(t('liturgy.errors.print_usage')); return; }
          openPrint(printDocument(docs, paper)); setError('');
        } catch { setError(t('liturgy.errors.range')); } }}>{t('liturgy.printPdf')}</button>
        <button className="wk-btn wk-btn-quiet" onClick={() => download(`${date}-${hour}.json`, JSON.stringify(compositions, null, 2))}>{t('liturgy.exportResolved')}</button>
      </div>
      {error && <p className="wk-error">{error}</p>}
      {compositions.map(c => <CompositionView key={c.hour} composition={c} libraryId={libraryId} details={details} />)}
    </>}
  </>;
}
function CompositionView({ composition: c, libraryId, details }: { composition: Composition; libraryId: string; details: boolean }) {
  const t = useT();
  return <article className="lit-office"><h2>{t(`liturgy.hours.${c.hour}`)}{c.vespers ? ` · ${t(`liturgy.${c.vespers}Vespers`)}` : ''}</h2>
    {c.day.date !== c.requestedDate && <p>{c.day.date} · {c.day.selected.title}</p>}
    {!c.complete && <p className="wk-note">{t('liturgy.incomplete')}</p>}
    {c.slots.map(s => s.status === 'omitted' && !details || !s.required && s.status === 'missing' && !details ? null : <section key={s.name} className={`lit-slot is-${s.status}`}>
      <h3>{t(`liturgy.slots.${s.label.replace(/\./g, '_')}`) === `liturgy.slots.${s.label.replace(/\./g, '_')}` ? s.label : t(`liturgy.slots.${s.label.replace(/\./g, '_')}`)}</h3>
      {s.status !== 'ready' && <p className="lit-status">{t(`liturgy.status.${s.status}`)}</p>}
      {s.antiphon && <div className="lit-antiphon"><TextBlocks blocks={s.antiphon.blocks} /></div>}<TextBlocks blocks={s.blocks} />{s.antiphon && <div className="lit-antiphon"><TextBlocks blocks={s.antiphon.blocks} /></div>}
      {s.resourceId && <a className="lit-meta" href={viewPath('library', libraryId, 'resource', s.resourceId)}>{s.resourceId}</a>}
      {details && <details><summary>{t('liturgy.why')}</summary><dl className="lit-facts"><div><dt>{t('liturgy.reason')}</dt><dd>{t(`liturgy.reasons.${s.reason}`)}</dd></div>{s.sourceLayer && <div><dt>{t('liturgy.layer')}</dt><dd>{t(`liturgy.layers.${s.sourceLayer}`)}</dd></div>}</dl><p className="lit-meta">{[s.assignmentId, s.ruleId, s.celebrationId, s.editionId, s.authority].filter(Boolean).join(' · ')}</p>{s.fallback && <p>{t('liturgy.fallback')}: {s.fallback}</p>}{s.rejected.length > 0 && <p>{s.rejected.join(', ')}</p>}</details>}
    </section>)}
    {details && c.diagnostics.length > 0 && <ul>{c.diagnostics.map((d, i) => <li key={i}>{t(`liturgy.diagnostic.${d.split(':')[0]}`)}{d.includes(':') ? ` · ${d.slice(d.indexOf(':') + 1)}` : ''}</li>)}</ul>}
  </article>;
}
function ImportHistory({ store, library }: { store: LibraryStore; library: OpenLibrary }) {
  const t = useT(), rows = store.ofKind('lit_import').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <><h2>{t('liturgy.tabs.history')}</h2>{rows.length === 0 && <p>{t('liturgy.noHistory')}</p>}<ul className="lit-history">{rows.map(e => <li key={e.id}><strong>{String(e.data.at)}</strong><p>{String(e.data.provenance ?? '')}</p><ul>{(Array.isArray(e.data.records) ? e.data.records as { entryId: string; canonicalId: string; action?: string; beforeVersion: number; afterVersion: number; checksum: string }[] : []).map(r => <li key={r.entryId}>{r.action === 'remove' ? <code>{r.canonicalId}</code> : <a href={viewPath('library', library.libraryId, 'resource', r.action === 'reset_default' ? r.canonicalId : r.entryId)}>{r.canonicalId}</a>}{r.action && <> · {t(`liturgy.actions.${r.action}`)}</>} · {r.beforeVersion} → {r.afterVersion}<details><summary>{t('liturgy.checksum')}</summary><code>{r.checksum}</code></details></li>)}</ul></li>)}</ul></>;
}
