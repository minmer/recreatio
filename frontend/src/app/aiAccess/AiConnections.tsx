/**
 * DOSTĘP DLA AI — VERBINDUNGEN (`#/workspace/account/dostep-ai`, 0138).
 *
 * Ein Assistent (ChatGPT, Claude …), der Recreatio über MCP verbunden hat, liest die Bereiche, die seine
 * Verbindung hält. Hier sieht der Mensch jede seiner Verbindungen, ihre Bereiche mit Zbiory, Stand und Frist,
 * und ändert sie OHNE neue Anmeldung: einen Bereich (oder einen ganzen Teilbaum) hinzufügen — mit einer
 * Übersicht dessen, was freigegeben wird, vor der Bestätigung —, einen Link verlängern, einen Bereich
 * herausnehmen, die Verbindung widerrufen. Der Dienst: `backend/Api/Library/AiMcpConnections.cs`.
 *
 * Hinzufügen heisst: der Link des Bereichs (ein vorhandener, sonst ein neuer für den ganzen Bereich) wird in
 * diesem Browser geöffnet — nur wer den Bereich prowadzi, kann das — und dem Dienst gereicht, der ihn an die
 * Verbindung bindet. Was der Assistent liest, bleibt dasselbe: nur lesen, nur Biblioteka, Skryptorium und
 * Bazy wiedzy, kein Lernstand, keine Antworten.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { fmtDate, tOr, useT, type T } from '../core/i18n';
import type { Ring } from '../core/keys';
import { forgetKeys, keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type LibraryKind } from '../library/library';
import { useCrumbs } from '../shell/crumbTrail';
import { Unlock } from '../shell/Unlock';
import { ask, toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import {
  addMcpArea, bestAreaLink, ensureAreaLink, extendAiAccess, loadAiAccess, loadMcpConnections, mcpUrl, removeMcpArea, revokeMcpConnection,
  type AiAccessList, type McpArea, type McpConnection
} from './aiAccess';

const DAY_CHOICES = [30, 90, 365] as const;
const PART_ORDER: Readonly<Record<LibraryKind, number>> = { books: 0, writing: 1, knowledge: 2, liturgy: 3 };

interface Container {
  readonly libraryId: string;
  readonly kind: LibraryKind;
  readonly name: string;
}

const day = (iso: string, t: T): string => fmtDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }, t.lang);

/** Was der Dienst sagt, in Worten (seine Codes), sonst die Meldung selbst. */
const said = (e: unknown, t: T): string => {
  if (e instanceof WorkspaceError || e instanceof Error) {
    if (e.message === '') return t('common.failed');
    return tOr(`aiAccess.error.${e.message}`, e.message, undefined, t.lang);
  }
  return t('common.failed');
};

export function AiConnectionsPage({ who }: { who: Who }) {
  const t = useT();
  useCrumbs([{ label: t('aiAccess.title'), href: null }]);

  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const [areas, setAreas] = useState<readonly AreaRow[] | null>(null);
  const [containers, setContainers] = useState<ReadonlyMap<string, readonly Container[]>>(new Map());
  const [list, setList] = useState<readonly McpConnection[] | null>(null);
  const [links, setLinks] = useState<ReadonlyMap<string, AiAccessList>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reloadConnections = useCallback(async () => {
    const found = (await loadMcpConnections()).connections;
    setList(found);
    /* Die Links der verbundenen Bereiche — für ihre Zbiory und zum Verlängern. */
    const next = new Map<string, AiAccessList>();
    for (const areaId of new Set(found.flatMap((c) => c.areas.map((a) => a.areaId)))) {
      const one = await loadAiAccess(areaId).catch(() => null);
      if (one !== null) next.set(areaId, one);
    }
    setLinks(next);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const keys = await keysFor(who);
        if (!alive) return;
        setRing(keys.ring);
        const all = (await loadAreas()).areas;
        const led = all.filter((a) => a.myLevel === 'admin');
        const rows = (await loadLibraries()).libraries.filter((r) => led.some((a) => a.areaId === r.areaId));
        const named = keys.ring === null ? [] : await openLibraries(keys.ring, rows);
        const byArea = new Map<string, Container[]>();
        for (const r of named) {
          const one = { libraryId: r.libraryId, kind: libraryKindOf(r), name: r.name };
          byArea.set(r.areaId, [...(byArea.get(r.areaId) ?? []), one]);
        }
        for (const [k, v] of byArea) byArea.set(k, [...v].sort((a, b) => PART_ORDER[a.kind] - PART_ORDER[b.kind] || a.name.localeCompare(b.name, t.locale)));
        if (!alive) return;
        setAreas(all);
        setContainers(byArea);
        await reloadConnections();
      } catch (e) {
        if (alive) setFailed(said(e, t));
      }
    })();
    return () => { alive = false; };
  }, [who, tick, reloadConnections, t]);

  const areaName = (areaId: string, fallback: string): string => {
    const row = areas?.find((a) => a.areaId === areaId);
    return row === undefined ? fallback : row.personal === true ? t('aiAccess.onlyYou') : row.name;
  };

  const run = async (label: string, todo: () => Promise<string | null>) => {
    setBusy(label);
    setFailed(null);
    try {
      const ok = await todo();
      await reloadConnections();
      if (ok !== null) toast(ok, { kind: 'ok' });
    } catch (e) {
      setFailed(said(e, t));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: McpConnection, a: McpArea) => {
    const name = areaName(a.areaId, a.areaName);
    if (!await ask({ title: t('aiAccess.remove.ask', { area: name }), body: t('aiAccess.remove.body'), confirm: t('aiAccess.remove.confirm'), danger: true })) return;
    await run(t('aiAccess.remove.working'), async () => { await removeMcpArea(c.id, a.accessId); return t('aiAccess.remove.done', { area: name }); });
  };

  const revoke = async (c: McpConnection) => {
    if (!await ask({ title: t('aiAccess.revoke.ask', { client: c.client }), body: t('aiAccess.revoke.body'), confirm: t('aiAccess.revoke.confirm'), danger: true })) return;
    await run(t('aiAccess.revoke.working'), async () => { await revokeMcpConnection(c.id); return t('aiAccess.revoke.done'); });
  };

  const renew = async (a: McpArea, days: number) => {
    const name = areaName(a.areaId, a.areaName);
    await run(t('aiAccess.renew.working'), async () => {
      const { expiresAt } = await extendAiAccess(a.areaId, a.accessId, days);
      return t('aiAccess.renew.done', { area: name, date: day(expiresAt, t) });
    });
  };

  return (
    <div className="wk-narrow ui-page">
      <PageHeader title={t('aiAccess.title')} />
      <p className="wk-lede">{t('aiAccess.lede')}</p>

      <section aria-labelledby="ai-how" className="wk-panel">
        <h2 className="wk-h2" id="ai-how">{t('aiAccess.how.title')}</h2>
        <p>{t('aiAccess.how.server')} <code>{mcpUrl()}</code></p>
        <ul>
          <li>{t('aiAccess.how.noReconnect')}</li>
          <li>{t('aiAccess.how.reconnect')}</li>
          <li>{t('aiAccess.how.readOnly')}</li>
        </ul>
      </section>

      {ring === undefined || (ring !== null && list === null && failed === null) ? (
        <Loading lines={3} />
      ) : ring === null ? (
        <Unlock who={who} why={t('aiAccess.unlockWhy')} onDone={() => { forgetKeys(); setTick((n) => n + 1); }} />
      ) : list === null ? null : list.length === 0 ? (
        <p className="wk-empty">{t('aiAccess.none')}</p>
      ) : (
        list.map((c) => (
          <section key={c.id} className="wk-panel" aria-labelledby={`ai-c-${c.id}`}>
            <div className="wk-link-head">
              <h2 className="wk-h2" id={`ai-c-${c.id}`}>{c.client}</h2>
              <span className="wk-tag wk-tag-open">{t('aiAccess.connection.until', { date: day(c.expiresAt, t) })}</span>
              <span className="wk-ai-when">
                {t('aiAccess.connection.since', { date: day(c.createdAt, t) })} · {c.lastUsedAt === null ? t('aiAccess.connection.neverUsed') : t('aiAccess.connection.used', { date: day(c.lastUsedAt, t) })}
              </span>
            </div>

            {c.areas.length === 0 ? (
              <p className="wk-empty">{t('aiAccess.connection.noAreas')}</p>
            ) : (
              <ul className="wk-link-list">
                {c.areas.map((a) => (
                  <ConnectedArea key={a.accessId} area={a} name={areaName(a.areaId, a.areaName)} list={links.get(a.areaId) ?? null}
                    containers={containers.get(a.areaId) ?? []} busy={busy !== null}
                    onRenew={(days) => void renew(a, days)} onRemove={() => void remove(c, a)} />
                ))}
              </ul>
            )}

            {adding === c.id && areas !== null ? (
              <AddArea connection={c} ring={ring} areas={areas} containers={containers} areaName={areaName}
                onCancel={() => setAdding(null)}
                onDone={async (message) => { setAdding(null); await reloadConnections(); if (message !== null) toast(message, { kind: 'ok' }); }} />
            ) : (
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || c.areas.length >= c.max} onClick={() => setAdding(c.id)}>{t('aiAccess.add.open')}</button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => void revoke(c)}>{t('aiAccess.revoke.open')}</button>
              </div>
            )}
          </section>
        ))
      )}

      <p className="wk-note">{t('aiAccess.older')}</p>
      {busy !== null && <p className="wk-working" role="status">{busy}</p>}
      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
    </div>
  );
}

/** Ein Bereich einer Verbindung: Name, Stand, bis wann, seine Zbiory — verlängern, herausnehmen. */
function ConnectedArea({ area, name, list, containers, busy, onRenew, onRemove }: {
  area: McpArea;
  name: string;
  list: AiAccessList | null;
  containers: readonly Container[];
  busy: boolean;
  onRenew: (days: number) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [days, setDays] = useState<number>(90);
  const row = list?.accesses.find((x) => x.id === area.accessId) ?? null;
  const parts = row?.parts ?? [];
  const nameOf = (libraryId: string, kind: LibraryKind) => containers.find((x) => x.libraryId === libraryId)?.name ?? t(`aiAccess.part.${kind}`);
  const canRenew = list?.leads === true && row !== null && (area.status === 'ok' || area.status === 'expired');

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>{name}</strong>
        <span className={area.status === 'ok' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{t(`aiAccess.status.${area.status}`)}</span>
        <span className="wk-ai-when">{t('aiAccess.area.until', { date: day(area.expiresAt, t) })}</span>
      </div>
      {area.status !== 'ok' && <p className="wk-warn">{t(`aiAccess.statusHelp.${area.status}`)}</p>}
      {area.wholeArea && <p className="wk-ai-whole">{t('aiAccess.area.whole')}</p>}
      {parts.length > 0 ? (
        <ul className="wk-ai-parts">
          {parts.map((p) => (
            <li key={p.libraryId}>
              <strong>{nameOf(p.libraryId, p.kind)}</strong>{' '}
              <span className="wk-tag">{t(`aiAccess.part.${p.kind}`)}</span>{' '}
              {p.madeFrom === null ? t('aiAccess.area.notReady') : p.fresh ? t('aiAccess.area.fresh') : t('aiAccess.area.stale')}
            </li>
          ))}
        </ul>
      ) : list !== null && <p className="wk-empty">{t('aiAccess.area.noCollections')}</p>}
      <div className="wk-actions">
        {canRenew && (
          <>
            <select className="wk-inline" value={days} disabled={busy} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('aiAccess.renew.for')}>
              {DAY_CHOICES.map((d) => <option key={d} value={d}>{t(`aiAccess.days.${d}`)}</option>)}
            </select>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onRenew(days)}>{t('aiAccess.renew.open')}</button>
          </>
        )}
        <button type="button" className="wk-link-btn" disabled={busy} onClick={onRemove}>{t('aiAccess.remove.open')}</button>
      </div>
    </li>
  );
}

interface Planned {
  readonly area: AreaRow;
  readonly collections: readonly Container[];
  /** Der vorhandene Link, den der Bereich gibt — `null`: ein neuer wird angelegt. */
  readonly linkUntil: string | null;
  readonly linkWhole: boolean;
  readonly already: boolean;
}

/**
 * BEREICH HINZUFÜGEN — wählen (einen Bereich, auf Wunsch mit allen darunter, die ich prowadzę), prüfen (welche
 * Zbiory, welcher Link, nur lesen, keine neue Anmeldung), bestätigen.
 */
function AddArea({ connection, ring, areas, containers, areaName, onCancel, onDone }: {
  connection: McpConnection;
  ring: Ring;
  areas: readonly AreaRow[];
  containers: ReadonlyMap<string, readonly Container[]>;
  areaName: (areaId: string, fallback: string) => string;
  onCancel: () => void;
  onDone: (message: string | null) => Promise<void>;
}) {
  const t = useT();
  const [chosen, setChosen] = useState('');
  const [subtree, setSubtree] = useState(true);
  const [days, setDays] = useState<number>(90);
  const [plan, setPlan] = useState<readonly Planned[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<readonly string[]>([]);

  /* Wählbar: Bereiche, die ich prowadzę und die eine Biblioteka, ein Skryptorium oder eine Baza wiedzy haben. */
  const offered = useMemo(() => areas.filter((a) => a.myLevel === 'admin' && (containers.get(a.areaId)?.length ?? 0) > 0), [areas, containers]);
  const inConnection = useMemo(() => new Set(connection.areas.map((a) => a.areaId)), [connection]);
  const below = useMemo(() => {
    if (chosen === '') return [];
    const out: AreaRow[] = [];
    const walk = (id: string) => {
      for (const child of areas.filter((a) => a.parentAreaId === id)) {
        if (offered.includes(child)) out.push(child);
        walk(child.areaId);
      }
    };
    walk(chosen);
    return out;
  }, [chosen, areas, offered]);

  const review = async () => {
    const root = offered.find((a) => a.areaId === chosen);
    if (root === undefined) return;
    setBusy(t('aiAccess.add.checking'));
    setFailed([]);
    try {
      const picked = [root, ...(subtree ? below : [])].slice(0, Math.max(1, connection.max - connection.areas.length));
      const out: Planned[] = [];
      for (const area of picked) {
        const best = bestAreaLink(await loadAiAccess(area.areaId));
        out.push({ area, collections: containers.get(area.areaId) ?? [], linkUntil: best?.expiresAt ?? null, linkWhole: best?.wholeArea === true, already: inConnection.has(area.areaId) });
      }
      setPlan(out);
    } catch (e) {
      setFailed([said(e, t)]);
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (plan === null) return;
    const added: string[] = [];
    const wrong: string[] = [];
    for (const [i, p] of plan.entries()) {
      const name = areaName(p.area.areaId, p.area.name);
      setBusy(t('aiAccess.add.adding', { area: name, n: i + 1, total: plan.length }));
      try {
        const { secret } = await ensureAreaLink(ring, p.area.areaId, p.collections.map((c) => c.libraryId), days,
          (done, total) => setBusy(t('aiAccess.add.snapshots', { area: name, done, total })));
        if (secret === null) { wrong.push(t('aiAccess.add.noKey', { area: name })); continue; }
        await addMcpArea(connection.id, secret);
        added.push(name);
      } catch (e) {
        wrong.push(`${name}: ${said(e, t)}`);
      }
    }
    setBusy(null);
    if (wrong.length > 0) { setFailed(wrong); setPlan(null); if (added.length > 0) await onDone(t('aiAccess.add.done', { areas: added.join(', ') })); return; }
    await onDone(added.length === 0 ? null : t('aiAccess.add.done', { areas: added.join(', ') }));
  };

  if (offered.length === 0) {
    return (
      <div className="wk-form">
        <p className="wk-empty">{t('aiAccess.add.nothing')}</p>
        <div className="wk-actions"><button type="button" className="wk-link-btn" onClick={onCancel}>{t('common.back')}</button></div>
      </div>
    );
  }

  return (
    <div className="wk-form" aria-live="polite">
      <h3 className="wk-h3">{t('aiAccess.add.title', { client: connection.client })}</h3>

      {plan === null ? (
        <>
          <AreaPick areas={areas} only={offered} value={chosen} onChange={(id) => { setChosen(id); setPlan(null); }} label={t('aiAccess.add.area')}
            placeholder={t('aiAccess.add.areaPlaceholder')} personalLabel={t('aiAccess.onlyYou')} disabled={busy !== null}
            note={(id) => (inConnection.has(id) ? t('aiAccess.add.already') : null)} />
          {below.length > 0 && (
            <label className="wk-check">
              <input type="checkbox" checked={subtree} disabled={busy !== null} onChange={(e) => setSubtree(e.target.checked)} />
              <span>{t('aiAccess.add.subtree', { count: below.length })}</span>
            </label>
          )}
          <label className="wk-field">
            <span>{t('aiAccess.add.days')}</span>
            <select value={days} disabled={busy !== null} onChange={(e) => setDays(Number(e.target.value))}>
              {DAY_CHOICES.map((d) => <option key={d} value={d}>{t(`aiAccess.days.${d}`)}</option>)}
            </select>
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy !== null || chosen === ''} onClick={() => void review()}>{t('aiAccess.add.review')}</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={onCancel}>{t('common.cancel')}</button>
          </div>
        </>
      ) : (
        <>
          <p>{t('aiAccess.add.reviewLede', { client: connection.client })}</p>
          <ul className="wk-link-list">
            {plan.map((p) => (
              <li key={p.area.areaId} className="wk-link-item">
                <div className="wk-link-head">
                  <strong>{areaName(p.area.areaId, p.area.name)}</strong>
                  {p.already && <span className="wk-tag">{t('aiAccess.add.already')}</span>}
                </div>
                <ul className="wk-ai-parts">
                  {p.collections.map((c) => <li key={c.libraryId}><strong>{c.name}</strong> <span className="wk-tag">{t(`aiAccess.part.${c.kind}`)}</span></li>)}
                </ul>
                <p className="wk-hint">
                  {p.linkUntil === null
                    ? t('aiAccess.add.newLink', { days: t(`aiAccess.days.${days}`) })
                    : t(p.linkWhole ? 'aiAccess.add.existingWhole' : 'aiAccess.add.existing', { date: day(p.linkUntil, t) })}
                </p>
              </li>
            ))}
          </ul>
          <p className="wk-note"><strong>{t('aiAccess.add.permissions')}</strong> {t('aiAccess.add.permissionsText')}</p>
          <p className="wk-note">{t('aiAccess.add.noReconnect')}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy !== null} onClick={() => void confirm()}>{t('aiAccess.add.confirm', { count: plan.length })}</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => setPlan(null)}>{t('common.back')}</button>
          </div>
        </>
      )}

      {busy !== null && <p className="wk-working" role="status">{busy}</p>}
      {failed.map((f) => <p key={f} className="wk-error" role="alert">{f}</p>)}
    </div>
  );
}

export default AiConnectionsPage;
