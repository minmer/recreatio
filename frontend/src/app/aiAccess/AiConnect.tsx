/**
 * POŁĄCZ Z ASYSTENTEM AI — `#/polacz-ai/<prośba>` (0127).
 *
 * Hierher schickt ein Assistent (ChatGPT) den Menschen, wenn er Recreatio als MCP-Server
 * verbindet (OAuth, `backend/Api/Library/AiOAuth.cs`). Der Mensch sieht, wer fragt und wohin es
 * zurückgeht, wählt Dostęp-dla-AI-Links von Bereichen, die er prowadzi (oder legt einen an),
 * und stimmt zu. Sein Browser öffnet die Geheimnisse der Links — nur er kann es — und reicht sie
 * dem Dienst; daraus wird das Token des Assistenten. Mehr bekommt er nicht: dieselben Behälter,
 * nur lesen, gelöscht ist gelöscht.
 */

import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import type { Ring } from '../core/keys';
import { forgetKeys, keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type LibraryKind } from '../library/library';
import { viewPath } from '../routes';
import { Unlock } from '../shell/Unlock';
import { Loading } from '../ui/Loading';
import { appLang, localeOf, rich, t as tApp, useT } from '../core/i18n';
import {
  aiSecretOf, approveConnect, createAiAccess, denyConnect, loadAiAccess, loadConnectRequest,
  type AiAccessRow, type ConnectRequest
} from './aiAccess';

/* Der Name eines Teils: `aiAccess.part.<kind>`. */

interface AreaLinks {
  readonly area: AreaRow;
  readonly links: readonly AiAccessRow[];
  /** Die Behälter des Bereichs (für die Namen und für einen neuen Link). */
  readonly containers: readonly { readonly libraryId: string; readonly kind: LibraryKind; readonly name: string }[];
}

const said = (e: unknown): string => (e instanceof WorkspaceError || e instanceof Error) && e.message !== '' ? e.message : tApp('common.failed');
const day = (iso: string): string => new Date(iso).toLocaleDateString(localeOf(appLang()), { day: 'numeric', month: 'short', year: 'numeric' });

export function AiConnect({ grantId, who }: { grantId: string | null; who: Who }) {
  const t = useT();
  const [request, setRequest] = useState<ConnectRequest | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const [areas, setAreas] = useState<readonly AreaLinks[] | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (grantId === null || grantId === '') throw new WorkspaceError(t('aiAccess.connect.noRequest'));
        const found = await loadConnectRequest(grantId);
        if (alive) setRequest(found);
      } catch (e) {
        if (alive) { setRequest(null); setFailed(said(e)); }
        return;
      }
      try {
        const keys = await keysFor(who);
        if (!alive) return;
        setRing(keys.ring);
        if (keys.ring === null) return;
        const led = (await loadAreas()).areas.filter((a) => a.myLevel === 'admin');
        const rows = (await loadLibraries()).libraries.filter((r) => led.some((a) => a.areaId === r.areaId));
        const named = await openLibraries(keys.ring, rows);
        const out: AreaLinks[] = [];
        for (const area of led) {
          const list = await loadAiAccess(area.areaId).catch(() => null);
          const containers = named.filter((r) => r.areaId === area.areaId).map((r) => ({ libraryId: r.libraryId, kind: libraryKindOf(r), name: r.name }));
          if (containers.length === 0 && (list === null || list.accesses.length === 0)) continue;
          out.push({ area, links: (list?.accesses ?? []).filter((a) => a.works && a.tokenSealed !== null), containers });
        }
        if (alive) {
          setAreas(out);
          /* Ein einziger Link: gleich gewählt. */
          const all = out.flatMap((a) => a.links);
          if (all.length === 1) setChosen(new Set([all[0].id]));
        }
      } catch (e) {
        if (alive) setFailed(said(e));
      }
    })();
    return () => { alive = false; };
  }, [grantId, who, tick]);

  if (request === undefined) return <Loading label={t('aiAccess.connect.checking')} />;
  if (request === null) {
    return (
      <>
        <h1 className="wk-h1">{t('aiAccess.connect.connection')}</h1>
        <p className="wk-error">{failed}</p>
      </>
    );
  }

  const nameOf = (entry: AreaLinks, libraryId: string, kind: LibraryKind) => entry.containers.find((c) => c.libraryId === libraryId)?.name ?? t(`aiAccess.part.${kind}`);
  const flip = (id: string) => setChosen((was) => { const next = new Set(was); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const approve = async () => {
    if (ring === null || ring === undefined || areas === null) return;
    setBusy(t('aiAccess.connect.connecting'));
    setFailed(null);
    try {
      const secrets: string[] = [];
      for (const entry of areas) {
        for (const row of entry.links) {
          if (!chosen.has(row.id)) continue;
          const secret = await aiSecretOf(ring, entry.area.areaId, row);
          if (secret === null) throw new WorkspaceError(t('aiAccess.connect.cannotOpen', { area: entry.area.name }));
          secrets.push(secret);
        }
      }
      const { redirect } = await approveConnect(request.id, secrets);
      window.location.href = redirect;
    } catch (e) {
      setFailed(said(e));
      setBusy(null);
    }
  };

  const deny = async () => {
    setBusy(t('aiAccess.connect.denying'));
    try {
      const { redirect } = await denyConnect(request.id);
      window.location.href = redirect;
    } catch (e) {
      setFailed(said(e));
      setBusy(null);
    }
  };

  const create = async (entry: AreaLinks) => {
    if (ring === null || ring === undefined) return;
    setBusy(t('aiAccess.connect.creating'));
    setFailed(null);
    try {
      const made = await createAiAccess(ring, entry.area.areaId, entry.containers.map((c) => c.libraryId), 90,
        (done, total) => setBusy(t('aiAccess.connect.snapshots', { done, total })));
      setChosen((was) => new Set([...was, made.id]));
      setTick((n) => n + 1);
    } catch (e) {
      setFailed(said(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1 className="wk-h1">{t('aiAccess.connect.title')}</h1>
      <p className="wk-lede">
        {rich(t('aiAccess.connect.lede', { client: request.client, host: request.redirectHost }), { b: (s, key) => <strong key={key}>{s}</strong> })}
      </p>
      <p className="wk-note">{t('aiAccess.connect.note')}</p>
      {/* 0138 — die Verbindung bekommt später weitere Bereiche, ohne neue Anmeldung. */}
      <p className="wk-hint">{t('aiAccess.connectLater')} <a href={viewPath('account', 'dostep-ai')}>{t('aiAccess.manage')}</a></p>

      {ring === undefined ? (
        <Loading lines={2} />
      ) : ring === null ? (
        <Unlock who={who} why={t('aiAccess.connect.unlockWhy')} onDone={() => { forgetKeys(); setTick((n) => n + 1); }} />
      ) : areas === null ? (
        failed === null ? <Loading lines={2} /> : null
      ) : areas.length === 0 ? (
        <p className="wk-empty">{t('aiAccess.connect.noAreas')} <a href={viewPath('areas')}>{t('aiAccess.connect.areas')}</a></p>
      ) : (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void approve(); }}>
          {areas.map((entry) => (
            <fieldset key={entry.area.areaId} className="wk-field">
              <legend>{entry.area.personal === true ? t('aiAccess.onlyYou') : entry.area.name}</legend>
              {entry.links.map((row) => (
                <label key={row.id} className="wk-check">
                  <input type="checkbox" checked={chosen.has(row.id)} onChange={() => flip(row.id)} disabled={busy !== null} />
                  <span>
                    {row.parts.map((p) => nameOf(entry, p.libraryId, p.kind)).join(', ') || t('aiAccess.connect.linkForAi')}{row.wholeArea === true ? ` ${t('aiAccess.connect.wholeArea')}` : ''}
                    {' '}<span className="wk-tag">{t('aiAccess.connect.validUntil', { date: day(row.expiresAt) })}</span>
                  </span>
                </label>
              ))}
              {entry.links.length === 0 && entry.containers.length > 0 && (
                <div className="wk-actions">
                  <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => void create(entry)}>
                    {t('aiAccess.connect.createLink', { names: entry.containers.map((c) => c.name).join(', ') })}
                  </button>
                </div>
              )}
            </fieldset>
          ))}
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy !== null || chosen.size === 0}>{t('aiAccess.connect.allow')}</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => void deny()}>{t('aiAccess.connect.deny')}</button>
          </div>
        </form>
      )}

      {busy !== null && <p className="wk-working" role="status">{busy}</p>}
      {failed !== null && request !== null && <p className="wk-error" role="alert">{failed}</p>}
    </>
  );
}

export default AiConnect;
