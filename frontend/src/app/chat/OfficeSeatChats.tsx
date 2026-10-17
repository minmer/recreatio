/**
 * 0104 — DIE ROZMOWA MIT DIESEM MENSCHEN, auf seiner Seite, für die Kanzlei.
 *
 * Öffnet ein Koordinator aus der „Lista osób" die Seite, die der Kandydat über
 * seinen Link sieht, stehen die Bausteine „Napisz do nas" und „Rozmowa grupy"
 * nicht leer da („…nie otworzyła tu żadnego linku"): sie zeigen die Rozmowa
 * „jeden na jeden" mit dem GEWÄHLTEN Menschen — die Kanzlei liest und
 * antwortet hier, als sie selbst. Gibt es noch keine, fängt sie sie an.
 *
 * <code>
 *   areaId gesetzt   die Rozmowa an diesem Bereich („Napisz do nas": seiner)
 *   areaId null      jede Rozmowa mit diesem Menschen („Rozmowa grupy")
 * </code>
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { loadMembers } from './area';
import { loadChats, startSeatChat, type ChatRow } from './chat';
import type { Ring } from './keys';
import { usePerson, type PagePerson } from './pagePerson';
import { PageChatRoom } from './PageChatView';
import { WorkspaceError } from './session';
import { Loading } from './ui/Loading';

type RolePerson = Extract<PagePerson, { kind: 'role' }>;

export function OfficeSeatChats({ seatId, areaId, ring, fallback }: {
  seatId: string | null;
  areaId: string | null;
  ring: Ring;
  /** Ohne Bereich und ohne Rozmowa: der Weg, eine anzufangen (dort wird der Bereich gewählt). */
  fallback?: ReactNode;
}) {
  const person = usePerson();
  const role: RolePerson | null = person?.chosen?.kind === 'role'
    ? person.chosen
    : person?.options.find((one): one is RolePerson => one.kind === 'role') ?? null;

  const [chats, setChats] = useState<readonly ChatRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    if (seatId === null) { setChats([]); return; }
    try {
      const found = (await loadChats()).chats.filter((c) => c.kind === 'seat' && c.seatId === seatId && (areaId === null || c.areaId === areaId));
      setChats(found);
    } catch (e) {
      setChats([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać rozmów.');
    }
  }, [seatId, areaId]);

  useEffect(() => { void look(); }, [look]);

  /* Anfangen — als eine Rolle, die den Bereich liest (wie „Napisz do tej osoby" in der Kanzlei). */
  const start = async () => {
    if (seatId === null || areaId === null) return;
    setBusy(true);
    setFailed(null);
    try {
      const { members } = await loadMembers(areaId);
      const as = members.find((m) => ring.has(m.roleId) && m.kind !== 'account'
        && (m.capabilities.includes('read') || m.capabilities.includes('write') || m.capabilities.includes('admin')));
      if (as === undefined) throw new WorkspaceError('Żadna z Twoich ról nie czyta obszaru tej rozmowy.');
      await startSeatChat(areaId, as.roleId, seatId);
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zacząć rozmowy.');
    } finally {
      setBusy(false);
    }
  };

  if (seatId === null) return <p className="wk-card-muted">Ta osoba nie ma własnego linku — nie ma z nią rozmowy jeden na jeden.</p>;
  if (chats === null) return <Loading label="Wczytywanie rozmowy…" />;
  if (role === null) return <p className="wk-card-muted">Rozmowę z tą osobą czyta się kontem koordynatora.</p>;

  if (chats.length === 0) {
    return (
      <div className="wk-office-chat" data-office-chat="">
        <p className="wk-card-muted">Nie ma jeszcze rozmowy z tą osobą.</p>
        {areaId !== null ? (
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} data-office-chat-start="" onClick={() => void start()}>
              {busy ? 'Otwieranie…' : 'Zacznij rozmowę z tą osobą'}
            </button>
          </div>
        ) : fallback}
        {failed !== null && <p className="wk-error">{failed}</p>}
      </div>
    );
  }

  return (
    <div className="wk-office-chat" data-office-chat="">
      {chats.map((chat) => (
        <section key={chat.chatId} className="wk-seat-chat">
          {chats.length > 1 && <h3 className="wk-seat-who">Rozmowa z prowadzącymi · {chat.areaName}</h3>}
          <PageChatRoom chatId={chat.chatId} ring={role.ring} asRoleId={role.id} />
        </section>
      ))}
      <p className="wk-hint">Widzisz rozmowę z wybraną osobą — odpowiadasz jako Ty, nie jako ona.</p>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
