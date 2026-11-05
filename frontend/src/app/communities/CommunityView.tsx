/**
 * 0137 — EINE WSPÓLNOTA: Struktur (Karte oder Liste), die Einstellungen jeder Einheit in fünf
 * Schritten, Osoby mit ihren Links, Obsada, JSON und Verlauf. Alles ändert zuerst einen ENTWURF;
 * „Zapisz zmiany" zeigt die Liste der Änderungen und führt sie aus (wie ein Import).
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { fmtDate, useT } from '../core/i18n';
import type { Ring } from '../core/keys';
import { WorkspaceError, type Who } from '../core/session';
import { linkUrlOf, loadLinks, type LinkRow } from '../links/linkAccess';
import { viewPath } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { flatten, findUnit, positionsOf, staffing, unitsOf, type CommunityDoc } from './community';
import { planLines } from './communityCompile';
import { addPeople, changed, moveUnit, removePerson, removeUnit, setPlaces, upsertPerson } from './communityEdit';
import { COMMUNITY_JSON, exportCommunity, readCommunity, type StoredCommunity } from './communityJson';
import { runCommunityImport } from './communityImport';
import { loadHistory, loadSetup, type HistoryEntry } from './communityStore';
import { RunDialog } from './CommunityRun';
import { StructureList } from './StructureList';
import { UnitSettings } from './UnitSettings';

const StructureMap = lazy(() => import('./StructureMap').then((m) => ({ default: m.StructureMap })));

export type CommunityTab = 'struktura' | 'jednostka' | 'osoby' | 'obsada' | 'json' | 'historia';
const TABS: readonly { id: CommunityTab; label: string }[] = [
  { id: 'struktura', label: 'communities.tabs.structure' }, { id: 'jednostka', label: 'communities.tabs.unit' }, { id: 'osoby', label: 'communities.tabs.people' },
  { id: 'obsada', label: 'communities.tabs.staffing' }, { id: 'json', label: 'communities.tabs.json' }, { id: 'historia', label: 'communities.tabs.history' }
];

const narrow = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 47.5rem)').matches === true;

export function CommunityView({ who, ring, areaId, tab, unitKey }: { who: Who; ring: Ring; areaId: string; tab: CommunityTab; unitKey: string | null }) {
  const t = useT();
  const [stored, setStored] = useState<StoredCommunity | null>(null);
  const [draft, setDraft] = useState<CommunityDoc | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [planning, setPlanning] = useState<{ renew?: readonly string[] } | null>(null);
  const [asList, setAsList] = useState(narrow());

  const reload = async () => {
    try {
      const [row, list] = await Promise.all([loadSetup(ring, areaId), loadAreas()]);
      setAreas(list.areas);
      if (row.missing) { setFailed(t('communities.migrationMissing')); return; }
      if (row.stored?.kind === 'unit') { window.location.hash = viewPath('wspolnoty', row.stored.view.community.areaId); return; }
      if (row.stored?.kind !== 'community') { setFailed(row.unreadable ? t('communities.view.unreadable') : t('communities.view.notCommunity')); return; }
      setStored(row.stored);
      setDraft(row.stored.doc);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('communities.view.loadFailed'));
    }
  };
  useEffect(() => { void reload(); }, [areaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useCrumbs([{ label: stored?.doc.name ?? '…', href: null }]);

  const names = useMemo(() => new Map(areas.map((a) => [a.areaId, a.name])), [areas]);
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (stored === null || draft === null) return <Loading />;

  const dirty = changed(stored.doc, draft);
  const selected = unitKey !== null && findUnit(draft, unitKey) !== undefined ? unitKey : draft.unit.key;
  const go = (to: CommunityTab, key?: string) => { window.location.hash = viewPath('wspolnoty', areaId, to, ...(key ? [key] : [])); };
  const areaHref = (key: string) => { const id = stored.state.units[key]; return id === undefined ? null : viewPath('areas', id); };

  return (
    <div className="wk-cm" data-community={areaId}>
      <PageHeader title={draft.name} meta={`${t('communities.count.units', { count: unitsOf(draft).length })} · ${t('communities.count.persons', { count: draft.persons.filter((p) => p.remove !== true).length })} · ${t('communities.count.positions', { count: draft.positions.length })}`}
        actions={<a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', areaId)}>{t('communities.view.topArea')}</a>} />
      <nav className="wk-tabs" aria-label={draft.name}>
        {TABS.map((x) => (
          <a key={x.id} className={tab === x.id ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('wspolnoty', areaId, x.id)} aria-current={tab === x.id ? 'page' : undefined}>{t(x.label)}</a>
        ))}
      </nav>
      {dirty && (
        <div className="wk-cm-savebar" data-cm-dirty="">
          <span>{t('communities.view.unsaved')}</span>
          <button type="button" className="wk-btn" onClick={() => setPlanning({})}>{t('communities.view.planAndSave')}</button>
          <button type="button" className="wk-btn wk-btn-line" onClick={() => setDraft(stored.doc)}>{t('communities.view.discard')}</button>
        </div>
      )}

      {tab === 'struktura' && (
        <>
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" onClick={() => setAsList(!asList)}>{asList ? t('communities.view.showMap') : t('communities.view.showList')}</button>
          </div>
          {asList
            ? <StructureList doc={draft} selected={selected} onPick={(k) => go('jednostka', k)} onMove={(k, to) => setDraft(moveUnit(draft, k, to))} />
            : <Suspense fallback={<Loading />}><StructureMap doc={draft} selected={selected} onPick={(k) => go('jednostka', k)} onMove={(k, to) => setDraft(moveUnit(draft, k, to))} /></Suspense>}
        </>
      )}

      {tab === 'jednostka' && (
        <>
          <div className="wk-cm-inline">
            <label className="wk-field"><span>{t('communities.view.unit')}</span>
              <select value={selected} onChange={(e) => go('jednostka', e.target.value)}>
                {flatten(draft.unit).map((f) => <option key={f.unit.key} value={f.unit.key}>{'· '.repeat(f.depth)}{f.unit.name}</option>)}
              </select>
            </label>
            {selected !== draft.unit.key && (
              findUnit(draft, selected)?.unit.remove
                ? <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => setDraft(removeUnit(draft, selected, false))}>{t('communities.view.restoreUnit')}</button>
                : <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => setDraft(removeUnit(draft, selected))}>{t('communities.view.dissolveUnit')}</button>
            )}
          </div>
          <UnitSettings doc={draft} unitKey={selected} onChange={setDraft} onOpen={(k) => go('jednostka', k)} areaHref={areaHref(selected)} />
        </>
      )}

      {tab === 'osoby' && <People doc={draft} stored={stored} ring={ring} onChange={setDraft} onRenew={(key) => setPlanning({ renew: [key] })} />}

      {tab === 'obsada' && <Staffing doc={draft} />}

      {tab === 'json' && (
        <JsonPanel
          summary={t('communities.view.jsonSummary')} open
          lead={t('communities.view.jsonLead')}
          fileName={`wspolnota-${draft.unit.key}.json`}
          exportDoc={() => exportCommunity(draft, names)}
          format={COMMUNITY_JSON}
          preview={(value) => {
            const read = readCommunity(value);
            if ('error' in read) return read;
            return { lines: planLines(read.doc, stored, names).map((l) => l.text), warnings: read.warnings };
          }}
          importLabel={t('common.import')}
          onImport={async (value, stage) => {
            const read = readCommunity(value);
            if ('error' in read) throw new WorkspaceError(read.error);
            const r = await runCommunityImport({ who, rootAreaId: areaId, doc: read.doc, stage });
            await reload();
            return { lines: [...r.lines, ...r.links.map((l) => t('communities.linkLine', { name: l.name, url: l.url }))], warnings: r.warnings };
          }}
        />
      )}

      {tab === 'historia' && <History ring={ring} areaId={areaId} onRestore={(doc) => { setDraft(doc); go('struktura'); }} />}

      {planning !== null && (
        <RunDialog who={who} rootAreaId={areaId} doc={draft} renew={planning.renew}
          lines={planning.renew ? [{ kind: 'person', text: t('communities.view.renewLine', { name: draft.persons.find((p) => p.key === planning.renew![0])?.name ?? '' }) }, ...planLines(draft, stored, names)] : planLines(draft, stored, names)}
          onClose={() => setPlanning(null)} onDone={() => void reload()} />
      )}
    </div>
  );
}

/* -- Osoby -------------------------------------------------------------------------------------- */

function People({ doc, stored, ring, onChange, onRenew }: { doc: CommunityDoc; stored: StoredCommunity; ring: Ring; onChange: (d: CommunityDoc) => void; onRenew: (key: string) => void }) {
  const t = useT();
  const units = unitsOf(doc);
  const [unit, setUnit] = useState(units[0]?.unit.key ?? '');
  const ps = (key: string) => { const u = findUnit(doc, key)?.unit; return u === undefined ? [] : positionsOf(doc, u); };
  const [position, setPosition] = useState('');
  const [names, setNames] = useState('');
  const [links, setLinks] = useState<readonly LinkRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { void loadLinks().then((r) => setLinks(r.invites), () => setLinks([])); }, [stored]);
  const pos = position !== '' ? position : ps(unit)[0]?.key ?? '';
  const unitName = (key: string) => flatten(doc.unit).find((f) => f.unit.key === key)?.unit.name ?? key;
  const posName = (key: string) => doc.positions.find((p) => p.key === key)?.name ?? key;
  const copy = async (row: LinkRow) => {
    const url = await linkUrlOf(ring, row);
    if (url !== null) { await navigator.clipboard?.writeText(url); setCopied(row.invitationId); }
  };
  return (
    <div className="wk-cm-people">
      <div className="wk-cm-box">
        <h3 className="wk-h3">{t('communities.people.addTitle')}</h3>
        <div className="wk-cm-inline">
          <label className="wk-field"><span>{t('communities.view.unit')}</span>
            <select value={unit} onChange={(e) => { setUnit(e.target.value); setPosition(''); }}>{units.map((f) => <option key={f.unit.key} value={f.unit.key}>{'· '.repeat(f.depth)}{f.unit.name}</option>)}</select>
          </label>
          <label className="wk-field"><span>{t('communities.people.position')}</span>
            <select value={pos} onChange={(e) => setPosition(e.target.value)}>{ps(unit).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
          </label>
        </div>
        <label className="wk-field"><span>{t('communities.people.namesLabel')}</span><textarea rows={4} value={names} onChange={(e) => setNames(e.target.value)} data-cm-names="" /></label>
        <button type="button" className="wk-btn wk-btn-line" disabled={names.trim() === '' || pos === ''} onClick={() => { onChange(addPeople(doc, unit, pos, names)); setNames(''); }}>{t('common.add')}</button>
      </div>
      <ul className="wk-cm-person-list">
        {doc.persons.map((p) => {
          const mark = stored.state.links[p.key];
          const row = mark === undefined ? undefined : links.find((l) => l.invitationId === mark.invitationId);
          return (
            <li key={p.key} className={p.remove ? 'is-removed' : undefined} data-person={p.key}>
              <div className="wk-cm-person-head">
                <input className="wk-cm-person-name" value={p.name} aria-label={t('communities.people.fullName')} onChange={(e) => onChange(upsertPerson(doc, { ...p, name: e.target.value }))} />
                <span className="wk-cm-meta">{row === undefined ? (mark === undefined ? t('communities.people.linkAfterSave') : t('communities.people.linkNotYours')) : row.revokedAt ? t('communities.people.linkRevoked') : t('communities.people.linkUntil', { date: row.expiresAt.slice(0, 10) })}</span>
                {row !== undefined && row.revokedAt === null && <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => void copy(row)}>{copied === row.invitationId ? t('common.copied') : t('communities.people.copyLink')}</button>}
                {mark !== undefined && !p.remove && <button type="button" className="wk-link-btn" onClick={() => onRenew(p.key)}>{t('communities.people.newLink')}</button>}
                <button type="button" className="wk-link-btn" onClick={() => onChange(removePerson(doc, p.key, p.remove !== true))}>{p.remove ? t('communities.people.restore') : t('common.remove')}</button>
              </div>
              <div className="wk-cm-chips">
                {p.places.map((pl, i) => (
                  <span key={i} className="wk-tag">{posName(pl.position)} · {unitName(pl.unit)}
                    <button type="button" className="wk-link-btn" aria-label={t('communities.people.takeOff')} onClick={() => onChange(setPlaces(doc, p.key, p.places.filter((_, j) => j !== i)))}>×</button>
                  </span>
                ))}
                <select aria-label={t('communities.people.newPlaceFor', { name: p.name })} value="" onChange={(e) => {
                  const [u, q] = e.target.value.split('|');
                  if (u && q) onChange(setPlaces(doc, p.key, [...p.places, { unit: u, position: q }]));
                }}>
                  <option value="">{t('communities.people.addPlace')}</option>
                  {units.flatMap((f) => ps(f.unit.key).map((q) => <option key={`${f.unit.key}|${q.key}`} value={`${f.unit.key}|${q.key}`}>{f.unit.name} — {q.name}</option>))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -- Obsada --------------------------------------------------------------------------------------- */

function Staffing({ doc }: { doc: CommunityDoc }) {
  const t = useT();
  const rows = staffing(doc);
  if (rows.length === 0) return <p className="wk-note">{t('communities.staffing.none')}</p>;
  return (
    <table className="wk-cm-table">
      <thead><tr><th>{t('communities.view.unit')}</th><th>{t('communities.people.position')}</th><th>{t('communities.staffing.have')}</th><th>{t('communities.staffing.want')}</th><th /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.unit}/${r.position}`} className={r.have < r.want ? 'is-short' : undefined}>
            <td>{r.unitName}</td><td>{r.positionName}</td><td>{r.have}</td><td>{r.want}</td>
            <td>{r.have < r.want ? t('communities.staffing.missing', { count: r.want - r.have }) : t('communities.staffing.enough')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -- Historia -------------------------------------------------------------------------------------- */

function History({ ring, areaId, onRestore }: { ring: Ring; areaId: string; onRestore: (doc: CommunityDoc) => void }) {
  const t = useT();
  const [entries, setEntries] = useState<readonly HistoryEntry[] | null>(null);
  useEffect(() => { void loadHistory(ring, areaId).then(setEntries, () => setEntries([])); }, [ring, areaId]);
  if (entries === null) return <Loading />;
  if (entries.length === 0) return <p className="wk-note">{t('communities.history.none')}</p>;
  return (
    <ul className="wk-cm-history">
      {entries.map((h) => (
        <li key={h.id}>
          <span>{t('communities.history.version', { at: fmtDate(new Date(h.at), { dateStyle: 'short', timeStyle: 'medium' }, t.lang), version: h.version })}</span>
          {h.stored?.kind === 'community' ? (
            <>
              <span className="wk-cm-meta">{t('communities.count.units', { count: unitsOf(h.stored.doc).length })} · {t('communities.count.persons', { count: h.stored.doc.persons.length })}</span>
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => onRestore((h.stored as StoredCommunity).doc)}>{t('communities.history.restore')}</button>
            </>
          ) : <span className="wk-cm-meta">{t('communities.history.unreadable')}</span>}
        </li>
      ))}
    </ul>
  );
}
