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
import {
  aiSecretOf, approveConnect, createAiAccess, denyConnect, loadAiAccess, loadConnectRequest,
  type AiAccessRow, type ConnectRequest
} from './aiAccess';

const PART_NAME: Readonly<Record<LibraryKind, string>> = { books: 'Biblioteka', writing: 'Skryptorium', knowledge: 'Baza wiedzy' };

interface AreaLinks {
  readonly area: AreaRow;
  readonly links: readonly AiAccessRow[];
  /** Die Behälter des Bereichs (für die Namen und für einen neuen Link). */
  readonly containers: readonly { readonly libraryId: string; readonly kind: LibraryKind; readonly name: string }[];
}

const said = (e: unknown): string => (e instanceof WorkspaceError || e instanceof Error) && e.message !== '' ? e.message : 'Nie udało się.';
const day = (iso: string): string => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

export function AiConnect({ grantId, who }: { grantId: string | null; who: Who }) {
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
        if (grantId === null || grantId === '') throw new WorkspaceError('W tym adresie brakuje prośby o połączenie.');
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

  if (request === undefined) return <Loading label="Sprawdzanie prośby o połączenie…" />;
  if (request === null) {
    return (
      <>
        <h1 className="wk-h1">Połączenie z asystentem AI</h1>
        <p className="wk-error">{failed}</p>
      </>
    );
  }

  const nameOf = (entry: AreaLinks, libraryId: string, kind: LibraryKind) => entry.containers.find((c) => c.libraryId === libraryId)?.name ?? PART_NAME[kind];
  const flip = (id: string) => setChosen((was) => { const next = new Set(was); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const approve = async () => {
    if (ring === null || ring === undefined || areas === null) return;
    setBusy('Łączenie…');
    setFailed(null);
    try {
      const secrets: string[] = [];
      for (const entry of areas) {
        for (const row of entry.links) {
          if (!chosen.has(row.id)) continue;
          const secret = await aiSecretOf(ring, entry.area.areaId, row);
          if (secret === null) throw new WorkspaceError(`Nie da się otworzyć linku w obszarze „${entry.area.name}” na tym urządzeniu.`);
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
    setBusy('Odmawianie…');
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
    setBusy('Tworzę link i przygotowuję odpisy…');
    setFailed(null);
    try {
      const made = await createAiAccess(ring, entry.area.areaId, entry.containers.map((c) => c.libraryId), 90,
        (done, total) => setBusy(`Przygotowuję odpisy… ${done}/${total}`));
      setChosen((was) => new Set([...was, made.id]));
      setTick((t) => t + 1);
    } catch (e) {
      setFailed(said(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1 className="wk-h1">Połącz z asystentem AI</h1>
      <p className="wk-lede">
        <strong>{request.client}</strong> chce czytać wybrane zbiory Recreatio — tylko czytać. Po zgodzie wrócisz do <strong>{request.redirectHost}</strong>.
      </p>
      <p className="wk-note">
        Asystent dostanie wyłącznie zaznaczone poniżej linki dostępu dla AI: przeczyta ich bibliotekę, skryptorium i bazy wiedzy,
        nic poza nimi, i niczego nie zmieni. To, co przeczyta, trafia do jego dostawcy. Odłączysz go, usuwając link
        (Obszar → Dostęp → Dostęp dla AI) — działa to od razu.
      </p>

      {ring === undefined ? (
        <Loading lines={2} />
      ) : ring === null ? (
        <Unlock who={who} why="Linki otwierają się tylko u Ciebie — podaj hasło." onDone={() => { forgetKeys(); setTick((t) => t + 1); }} />
      ) : areas === null ? (
        failed === null ? <Loading lines={2} /> : null
      ) : areas.length === 0 ? (
        <p className="wk-empty">Nie prowadzisz żadnego obszaru z biblioteką, skryptorium albo bazą wiedzy. <a href={viewPath('areas')}>Obszary</a></p>
      ) : (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void approve(); }}>
          {areas.map((entry) => (
            <fieldset key={entry.area.areaId} className="wk-field">
              <legend>{entry.area.personal === true ? 'Tylko Ty' : entry.area.name}</legend>
              {entry.links.map((row) => (
                <label key={row.id} className="wk-check">
                  <input type="checkbox" checked={chosen.has(row.id)} onChange={() => flip(row.id)} disabled={busy !== null} />
                  <span>
                    {row.parts.map((p) => nameOf(entry, p.libraryId, p.kind)).join(', ') || 'Link dla AI'}{row.wholeArea === true ? ' — cały obszar, także nowe zbiory' : ''}
                    {' '}<span className="wk-tag">ważny do {day(row.expiresAt)}</span>
                  </span>
                </label>
              ))}
              {entry.links.length === 0 && entry.containers.length > 0 && (
                <div className="wk-actions">
                  <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => void create(entry)}>
                    Utwórz link dla AI ({entry.containers.map((c) => c.name).join(', ')})
                  </button>
                </div>
              )}
            </fieldset>
          ))}
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy !== null || chosen.size === 0}>Zezwól</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => void deny()}>Odmów</button>
          </div>
        </form>
      )}

      {busy !== null && <p className="wk-working" role="status">{busy}</p>}
      {failed !== null && request !== null && <p className="wk-error" role="alert">{failed}</p>}
    </>
  );
}

export default AiConnect;
