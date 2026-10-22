/**
 * 0120 — DIE OBSZARY EINER PERSON, im Panel der Kanzlei.
 *
 * Je virtuellem Bereich des Formulars der Kleinbereich DIESER Einsendung, mit
 * der Rozmowa darin:
 *
 * <code>
 *   die Person gehört dazu (czyta/pisze)   eine Rozmowa mit ihr allein (kind seat, am Kleinbereich)
 *   nur die Leiter (nie widzi)             ihre Rozmowa ÜBER die Person (kind area)
 * </code>
 *
 * Fehlt der Kleinbereich noch, legt ihn dieser Browser hier an — nach der
 * Regel, wie überall (`applyVirtualArea`), nur für diese eine Person.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadMembers } from '../areas/area';
import { loadChats, startAreaChat, startSeatChat } from '../chat/chat';
import { PageChatRoom } from '../chat/PageChatView';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import {
  applyVirtualArea, loadRegistrationAreas, loadVirtualPlan, SUBMITTER_WORDS, type RegistrationArea, type RegistrationAreas
} from './virtualAreas';

/** Eine meiner Rollen, die im Kleinbereich schreibt — als sie spricht die Kanzlei dort zuerst. */
async function writerIn(ring: Ring, areaId: string): Promise<string | null> {
  const { members } = await loadMembers(areaId);
  const writes = (c: readonly string[]) => c.includes('write') || c.includes('admin');
  return members.find((m) => m.kind === 'person' && ring.has(m.roleId) && writes(m.capabilities))?.roleId
    ?? members.find((m) => m.kind !== 'account' && ring.has(m.roleId) && writes(m.capabilities))?.roleId
    ?? null;
}

export function PersonAreas({ registrationId, ring, onError }: {
  registrationId: string;
  ring: Ring | null;
  onError: (message: string | null) => void;
}) {
  const [state, setState] = useState<RegistrationAreas | null>(null);
  const [chats, setChats] = useState<ReadonlyMap<string, string>>(new Map());
  const [writers, setWriters] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const read = useCallback(async () => {
    try {
      const now = await loadRegistrationAreas(registrationId);
      const ids = new Set(now.areas.flatMap((a) => (a.areaId === null ? [] : [a.areaId])));
      const found = new Map<string, string>();
      if (ids.size > 0) {
        const withPerson = new Set(now.areas.flatMap((a) => (a.areaId !== null && a.submitterLevel !== 'none' && now.seatId != null ? [a.areaId] : [])));
        for (const chat of (await loadChats()).chats) {
          if (!ids.has(chat.areaId)) continue;
          const wanted = withPerson.has(chat.areaId) ? chat.kind === 'seat' && chat.seatId === now.seatId : chat.kind === 'area';
          if (wanted) found.set(chat.areaId, chat.chatId);
        }
      }
      const who = new Map<string, string | null>();
      if (ring !== null) {
        for (const id of ids) who.set(id, await writerIn(ring, id).catch(() => null));
      }
      setChats(found);
      setWriters(who);
      setState(now);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać obszarów osoby.');
      setState({ registrationId, moduleId: '', ready: false, areas: [] });
    }
  }, [registrationId, ring, onError]);

  useEffect(() => { void read(); }, [read]);

  const act = async (what: string, todo: () => Promise<void>) => {
    setBusy(what);
    onError(null);
    try { await todo(); } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally { setBusy(null); }
  };

  const create = (area: RegistrationArea) => act('Zakładanie obszaru…', async () => {
    if (ring === null) throw new WorkspaceError('Najpierw podaj hasło.');
    const done = await applyVirtualArea(ring, await loadVirtualPlan(area.virtualAreaId), { only: registrationId });
    if (done.noIssuer) throw new WorkspaceError('Ten obszar zakłada ten, kto prowadzi regułę „' + area.name + '”.');
    await read();
  });

  const talk = (area: RegistrationArea, areaId: string) => act('Otwieranie rozmowy…', async () => {
    const as = writers.get(areaId) ?? null;
    if (as === null) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tym obszarze.');
    const seatId = state?.seatId ?? null;
    const chatId = area.submitterLevel !== 'none' && seatId !== null
      ? await startSeatChat(areaId, as, seatId)
      : await startAreaChat(areaId, as);
    setChats(new Map(chats).set(areaId, chatId));
  });

  if (state === null) return <Loading label="Wczytywanie…" />;
  if (!state.ready || state.areas.length === 0) return null;

  return (
    <div className="wk-person-areas" data-person-areas="">
      {state.areas.map((area) => {
        const chatId = area.areaId === null ? undefined : chats.get(area.areaId);
        const as = area.areaId === null ? null : writers.get(area.areaId) ?? null;
        return (
          <section key={area.virtualAreaId} className="wk-person-area" data-person-area={area.virtualAreaId}>
            <h4 className="wk-h3">
              {area.name}
              <span className="wk-row-side"> · {SUBMITTER_WORDS[area.submitterLevel]}</span>
            </h4>
            {area.areaId === null ? (
              <div className="wk-actions">
                <span>Ta osoba nie ma jeszcze tego obszaru.</span>
                <button type="button" className="wk-btn" disabled={busy !== null || ring === null} data-person-area-create=""
                  onClick={() => void create(area)}>
                  Załóż
                </button>
              </div>
            ) : chatId !== undefined && ring !== null && as !== null ? (
              <PageChatRoom chatId={chatId} ring={ring} asRoleId={as} />
            ) : (
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || ring === null || as === null}
                  data-person-area-talk="" onClick={() => void talk(area, area.areaId!)}>
                  {area.submitterLevel === 'none' || state.seatId == null ? 'Zacznij notatki o tej osobie' : 'Zacznij rozmowę z tą osobą'}
                </button>
              </div>
            )}
          </section>
        );
      })}
      {busy !== null && <p className="wk-note" role="status">{busy}</p>}
    </div>
  );
}

export default PersonAreas;
