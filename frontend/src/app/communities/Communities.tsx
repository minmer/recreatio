/**
 * 0137 — „WSPÓLNOTY" (`#/workspace/wspolnoty`): die eigenen Wspólnoty, „Nowa wspólnota" (die geführte
 * Einrichtung), eine neue aus JSON, und mehrere unter eine neue Einheit legen (zwei Rejony unter die
 * Diözese). `…/wspolnoty/<wurzel>/<reiter>/<einheit>` öffnet eine.
 */

import { useEffect, useState } from 'react';

import { loadAreas } from '../areas/area';
import { useT } from '../core/i18n';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { viewPath } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { Unlock } from '../shell/Unlock';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { slug, unitsOf } from './community';
import { planLines } from './communityCompile';
import { COMMUNITY_JSON, readCommunity, type StoredCommunity } from './communityJson';
import { mergeCommunities, runCommunityImport } from './communityImport';
import { loadSetup } from './communityStore';
import { RunDialog } from './CommunityRun';
import { CommunityView, type CommunityTab } from './CommunityView';
import { Wizard } from './Wizard';

const TAB_IDS: readonly CommunityTab[] = ['struktura', 'jednostka', 'osoby', 'obsada', 'json', 'historia'];

interface Row { readonly areaId: string; readonly stored: StoredCommunity }

export function Communities({ who, trail }: { who: Who; trail: readonly string[] }) {
  const t = useT();
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const look = async () => setRing((await keysFor(who)).ring);
  useEffect(() => { void look(); }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ring === undefined) return <Loading />;
  if (ring === null) return <Unlock who={who} why={t('communities.list.unlockWhy')} onDone={() => void look()} />;
  if (trail[0] === 'nowa') return <Wizard who={who} />;
  if (trail[0] !== undefined && /^[0-9a-f-]{36}$/i.test(trail[0])) {
    const tab = (TAB_IDS as readonly string[]).includes(trail[1] ?? '') ? trail[1] as CommunityTab : 'struktura';
    return <CommunityView who={who} ring={ring} areaId={trail[0]} tab={tab} unitKey={trail[2] ?? null} />;
  }
  return <List who={who} ring={ring} />;
}

function List({ who, ring }: { who: Who; ring: Ring }) {
  const t = useT();
  useCrumbs([]);
  const [rows, setRows] = useState<readonly Row[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pick, setPick] = useState<ReadonlySet<string>>(new Set());
  const [topName, setTopName] = useState('');
  const [merging, setMerging] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { areas } = await loadAreas();
        const mine = areas.filter((a) => a.myLevel === 'admin' && a.personal !== true);
        const found: Row[] = [];
        /* Je Bereich ein Blick — sechs auf einmal. */
        for (let i = 0; i < mine.length; i += 6) {
          const got = await Promise.all(mine.slice(i, i + 6).map(async (a) => {
            const row = await loadSetup(ring, a.areaId).catch(() => null);
            if (row?.missing) throw new WorkspaceError(t('communities.migrationMissing'));
            return row?.stored?.kind === 'community' ? { areaId: a.areaId, stored: row.stored } : null;
          }));
          for (const g of got) if (g !== null) found.push(g);
        }
        if (alive) setRows(found);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('communities.list.loadFailed'));
      }
    })();
    return () => { alive = false; };
  }, [ring]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = (rows ?? []).filter((r) => pick.has(r.areaId));
  const merged = merging && chosen.length >= 2 && topName.trim() !== ''
    ? mergeCommunities(chosen.map((r) => r.stored), { key: slug(topName), name: topName.trim(), kind: 'organisation' }) : null;

  return (
    <div className="wk-cm" data-communities="">
      <PageHeader title={t('communities.list.title')} meta={t('communities.list.meta')}
        actions={<a className="wk-btn" href={viewPath('wspolnoty', 'nowa')} data-cm-new="">{t('communities.list.new')}</a>} />
      {failed && <p className="wk-error">{failed}</p>}
      {rows === null && failed === null ? <Loading /> : rows !== null && (
        rows.length === 0 ? <p className="wk-empty">{t('communities.list.empty')}</p> : (
          <ul className="wk-cm-list">
            {rows.map((r) => (
              <li key={r.areaId}>
                <label className="wk-check"><input type="checkbox" checked={pick.has(r.areaId)} aria-label={t('communities.list.pick', { name: r.stored.doc.name })}
                  onChange={(e) => setPick((was) => { const n = new Set(was); if (e.target.checked) n.add(r.areaId); else n.delete(r.areaId); return n; })} /></label>
                <a className="wk-link" href={viewPath('wspolnoty', r.areaId)}><strong>{r.stored.doc.name}</strong></a>
                <span className="wk-cm-meta">{t('communities.count.units', { count: unitsOf(r.stored.doc).length })} · {t('communities.count.persons', { count: r.stored.doc.persons.filter((p) => p.remove !== true).length })}</span>
              </li>
            ))}
          </ul>
        )
      )}
      {chosen.length >= 2 && (
        <div className="wk-cm-box" data-cm-merge="">
          <h2 className="wk-h3">{t('communities.list.mergeTitle')}</h2>
          <p className="wk-note">{t('communities.list.mergeNote')}</p>
          <label className="wk-field"><span>{t('communities.list.topName')}</span><input value={topName} placeholder={t('communities.list.topNamePlaceholder')} onChange={(e) => setTopName(e.target.value)} /></label>
          <button type="button" className="wk-btn" disabled={topName.trim() === ''} onClick={() => setMerging(true)}>{t('communities.list.seePlan')}</button>
        </div>
      )}
      {merged !== null && (
        <RunDialog who={who} rootAreaId={null} doc={merged.doc} seed={merged} title={t('communities.list.mergePlan')}
          lines={planLines(merged.doc, { kind: 'community', ...merged, view: chosen[0].stored.view }, new Map())}
          onClose={() => { setMerging(false); if (made !== null) window.location.hash = viewPath('wspolnoty', made); }} onDone={(r) => setMade(r.rootAreaId)} />
      )}
      <JsonPanel
        summary={t('communities.list.jsonSummary')}
        lead={t('communities.list.jsonLead')}
        fileName="wspolnota.json"
        exportDoc={() => ({ format: 'recreatio/community', version: 1 })}
        format={COMMUNITY_JSON}
        preview={(value) => {
          const read = readCommunity(value);
          if ('error' in read) return read;
          return { lines: planLines(read.doc, null, new Map()).map((l) => l.text), warnings: read.warnings };
        }}
        importLabel={t('communities.list.create')}
        onImport={async (value, stage) => {
          const read = readCommunity(value);
          if ('error' in read) throw new WorkspaceError(read.error);
          const r = await runCommunityImport({ who, rootAreaId: null, doc: read.doc, stage });
          return { lines: [...r.lines, t('communities.list.madeLine', { url: `${window.location.origin}${window.location.pathname}${viewPath('wspolnoty', r.rootAreaId)}` }), ...r.links.map((l) => t('communities.linkLine', { name: l.name, url: l.url }))], warnings: r.warnings };
        }}
      />
    </div>
  );
}
