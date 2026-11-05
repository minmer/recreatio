/**
 * 0137 — „MOJE WSPÓLNOTY" (`#/moje`): wohin ein persönlicher Link führt, ohne Konto. Begrüssung mit
 * Namen, dann alle eigenen Einheiten mit der Rolle darin („Krąg 3 — Członek kręgu", „Rejon XIII —
 * Para rejonowa (prowadzenie)"), was seit dem letzten Besuch neu ist, und die Wege hinein: die Seite
 * der Einheit, der Kalender, die Rozmowy.
 *
 * <b>Woher es das weiss.</b> Der Link hält Rollen (0091); deren Bereiche sagt der Dienst
 * (`/links/keys`). In jedem Bereich liegt, versiegelt unter seinem Schlüssel, was seine Menschen
 * lesen sollen (`UnitView`): Name, Positionen, wer dazugehört — daran erkennt der Link sich selbst.
 */

import { useEffect, useState } from 'react';

import { LinkChatsSection } from '../chat/LinkChatJoin';
import { heldLinkKeys, type HeldKeys } from '../links/linkAccess';
import { linkChats, loadLinkMessages } from '../links/linkPerson';
import { linkMe } from '../links/linkMe';
import { pagePath, viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { rightsLabel, type Rights } from './community';
import type { UnitView } from './communityJson';
import { loadSetup } from './communityStore';

const SEEN = 'recreatio:moje:seen:v1';
const readSeen = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string>; } catch { return {}; } };
const markSeen = (areaId: string) => { try { localStorage.setItem(SEEN, JSON.stringify({ ...readSeen(), [areaId]: new Date().toISOString() })); } catch { /* ohne Gedächtnis */ } };
const LEVEL: Record<string, string> = { read: 'czyta', write: 'pisze', admin: 'prowadzi' };

interface Place {
  readonly areaId: string;
  readonly name: string;
  readonly view: UnitView | null;
  readonly roles: readonly string[];
  readonly capability: string;
  readonly fresh: number;
}

export function MyUnits() {
  const [keys, setKeys] = useState<HeldKeys | null>(null);
  const [places, setPlaces] = useState<readonly Place[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await linkMe().catch(() => null);
      const held = await heldLinkKeys().catch(() => ({ links: [], areaKeys: new Map(), roles: [] }) as HeldKeys);
      if (!alive) return;
      setKeys(held);
      const roleIds = new Set(held.roles.map((r) => r.roleId));
      const linkRoles = new Set(held.links.map((l) => l.info?.roleId).filter((x): x is string => x !== undefined));
      const byArea = new Map<string, { name: string; capability: string }>();
      const rank = (c: string) => ({ read: 1, write: 2, admin: 3 }[c] ?? 0);
      for (const r of held.roles) for (const a of r.areas) {
        const had = byArea.get(a.areaId);
        if (had === undefined || rank(a.capability) > rank(had.capability)) byArea.set(a.areaId, { name: a.name || had?.name || '', capability: a.capability });
      }
      const seen = readSeen();
      const chats = await linkChats().catch(() => []);
      const out: Place[] = [];
      let name: string | null = null;
      for (const [areaId, info] of byArea) {
        const row = await loadSetup(null, areaId).catch(() => null);
        const view = row?.stored?.view ?? null;
        const mine = view?.people.find((p) => p.linkRoleId !== null && linkRoles.has(p.linkRoleId));
        if (mine !== undefined && name === null) name = mine.name;
        const holding = view?.positions.filter((p) => p.roleId !== null && roleIds.has(p.roleId)).map((p) => p.key) ?? [];
        let fresh = 0;
        const since = seen[areaId];
        if (since !== undefined) {
          for (const c of chats.filter((x) => x.areaId === areaId)) {
            const got = await loadLinkMessages(c.chatId, { after: since }).catch(() => ({ messages: [] }));
            fresh += got.messages.filter((m) => m.deletedAt === null).length;
          }
          if (view !== null && view.updatedAt > since) fresh += 1;
        }
        out.push({ areaId, name: view?.unit.name ?? info.name ?? 'Obszar', view, roles: [...new Set([...holding, ...(mine?.positions ?? [])])], capability: info.capability, fresh });
      }
      /* Nur Einheiten einer Wspólnota — Hilfsbereiche (z. B. die Antwortenden von „Napisz do nas") zeigen sich nicht. */
      const shown = out.filter((p) => p.view !== null);
      out.splice(0, out.length, ...(shown.length > 0 ? shown : out));
      out.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
      if (alive) { setPlaces(out); setMe(name); }
      /* Dieser Besuch ist der letzte — beim nächsten zählt, was danach kam. */
      for (const p of out) markSeen(p.areaId);
    })();
    return () => { alive = false; };
  }, []);

  if (keys === null || places === null) return <Loading label="Otwieranie Twoich wspólnot…" />;
  if (keys.links.length === 0) return <p className="wk-empty">Ta przeglądarka nie ma osobistego linku. Otwórz link, który dostałeś od prowadzących.</p>;
  const communities = [...new Map(places.filter((p) => p.view !== null).map((p) => [p.view!.community.areaId, p.view!.community.name])).values()];

  return (
    <div className="wk-narrow ui-page wk-cm-mine" data-my-units="">
      <PageHeader title={me === null ? 'Witaj!' : `Witaj, ${me}!`} meta={communities.length > 0 ? communities.join(' · ') : 'Twoje miejsca z tego linku'} />
      {places.length === 0 ? <p className="wk-note">Ten link nie daje jeszcze dostępu do żadnej jednostki.</p> : (
        <ul className="wk-cm-mine-list">
          {places.map((p) => {
            const words = p.roles.map((key) => {
              const pos = p.view?.positions.find((x) => x.key === key);
              return pos === undefined ? key : `${pos.name}${pos.rights === 'lead' ? ` (${rightsLabel(pos.rights as Rights).toLowerCase()})` : ''}`;
            });
            return (
              <li key={p.areaId} data-my-unit={p.areaId}>
                <div className="wk-cm-mine-head">
                  <strong>{p.name}</strong>
                  {p.fresh > 0 && <span className="wk-tag wk-cm-new">nowe: {p.fresh}</span>}
                </div>
                <span className="wk-cm-meta">{words.length > 0 ? words.join(', ') : `tu ${LEVEL[p.capability] ?? 'czytasz'}`}</span>
                <div className="wk-actions">
                  {p.view?.home && <a className="wk-btn wk-btn-small" href={pagePath(p.view.home)} onClick={() => markSeen(p.areaId)}>Otwórz</a>}
                  <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('calendar')} onClick={() => markSeen(p.areaId)}>Kalendarz</a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <h2 className="wk-h3">Rozmowy</h2>
      {keys.links.filter((l) => l.info !== null).map((l) => <LinkChatsSection key={l.token} invitationId={l.info!.invitationId} />)}
    </div>
  );
}

export default MyUnits;
