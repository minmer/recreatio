/**
 * DIE ROZMOWA AUF DER SEITE DES MENSCHEN MIT DEM LINK (0053).
 *
 * Hat der Bereich seines Platzes eine Rozmowa, steht sie hier — lesen und
 * schreiben, ohne Konto. Zwei Orte zeigen sie: die eingebauten Abschnitte
 * (`PersonalSections`, nur wenn es eine gibt) und der Baustein
 * „Rozmowa grupy", den die Kanzlei auf eine Seite legt.
 *
 * <b>Beim ersten Mal fehlt der Schlüssel noch.</b> Sein Browser legt dann die
 * Identität an, und den Chatschlüssel verpackt ihm ein Mitglied, sobald es
 * die Rozmowa öffnet. Bis dahin sagt die Seite das — und sieht selbst nach.
 */

import { useChatExtras } from './ChatExtras';
import {
  Avatar, ChatHeader, ChatLog, Composer, lastEditable, useChatChrome, withDelete, withEdit,
  type ComposerHandle, type MessageHandlers, type MessageRules, type ReplyTarget, type Shown
} from './ChatKit';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { authorOf, openMessage, openVersion, type Opened, type SealedMessage, type SealedVersion, type SendOptions } from './chat';
import { HistoryDialog } from './MessageBits';
import type { SeatView } from './seatContext';
import {
  chatNameFor, deleteSeatMessage, editSeatMessage, keepChatName, loadSeatChats, loadSeatMessages, loadSeatVersions,
  restoreSeatMessage, seatChatKeys, seatIdentity, sendSeatMessage, type SeatChatRow, type SeatIdentity
} from './seatChat';
import { WorkspaceError } from './session';

interface Ready {
  readonly row: SeatChatRow;
  readonly keys: ReadonlyMap<number, Uint8Array>;
}

interface SeatChats {
  /** `undefined` — wird geholt; leer — der Bereich hat keine Rozmowa. */
  readonly chats: readonly Ready[] | undefined;
  readonly identity: SeatIdentity | null;
  readonly failed: string | null;
}

/** Die Rozmowy eines Platzes, mit den Schlüsseln, die schon bei ihm sind. */
export function useSeatChats(seat: SeatView): SeatChats {
  const [chats, setChats] = useState<readonly Ready[] | undefined>(undefined);
  const [identity, setIdentity] = useState<SeatIdentity | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { token, seatId, seatKey } = seat;

  const look = useCallback(async () => {
    if (seatKey === null) { setChats([]); return; }
    try {
      const found = await loadSeatChats(token);

      /* Keine Rozmowa — dann auch keine Identität: niemand braucht sie. */
      if (found.chats.length === 0) { setChats([]); return; }

      const mine = await seatIdentity(token, seatId, seatKey, found.identity);
      const ready = await Promise.all(found.chats.map(async (row) => ({ row, keys: await seatChatKeys(mine, seatId, row) })));
      setIdentity(mine);
      setChats(ready);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
      setChats((was) => was ?? []);
    }
  }, [token, seatId, seatKey]);

  useEffect(() => { void look(); }, [look]);

  /* Solange ein Schlüssel fehlt: nachsehen, ob ihn inzwischen jemand weitergegeben hat. */
  const waiting = chats?.some((one) => one.keys.size === 0) ?? false;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void look(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [waiting, look]);

  return { chats, identity, failed };
}

/** Für die eingebauten Abschnitte: je Rozmowa ein Abschnitt — oder nichts. */
export function SeatChatSections({ seat, frame }: {
  seat: SeatView;
  frame: (title: string, who: string, body: ReactNode, key: string) => ReactNode;
}) {
  const { chats, identity, failed } = useSeatChats(seat);
  if (chats === undefined || chats.length === 0) return failed === null ? null : <p className="wk-error">{failed}</p>;

  return (
    <>
      {chats.map((one) => frame(
        `Rozmowa: ${one.row.areaName}`,
        `Czytają i piszą wszyscy z grupy „${one.row.areaName}" — także kancelaria. Treść szyfruje Twoja przeglądarka.`,
        <SeatChatRoom seat={seat} chat={one} identity={identity} />,
        one.row.chatId
      ))}
    </>
  );
}

/**
 * Für den Baustein: die Rozmowa, oder dass es keine gibt.
 *
 * <b>`only`</b> — der Baustein „Rozmowa" nennt EINE beim Namen; dann steht
 * hier auch nur sie, und nicht jede Rozmowa, die dieser Platz sonst noch hat.
 * Ohne `only` (der Baustein „Rozmowa grupy") stehen alle da wie bisher.
 */
export function SeatChatBody({ seat, only }: { seat: SeatView; only?: string }) {
  const { chats: found, identity, failed } = useSeatChats(seat);
  const chats = found === undefined || only === undefined ? found : found.filter((one) => one.row.chatId === only);

  if (chats === undefined) return <p className="wk-card-muted">Wczytywanie rozmowy…</p>;
  if (chats.length === 0 && only !== undefined && (found?.length ?? 0) > 0) {
    return <p className="wk-card-muted">Ta rozmowa nie należy do Twojej grupy — dla Ciebie nic tu nie ma.</p>;
  }
  if (chats.length === 0) {
    return failed !== null
      ? <p className="wk-error">{failed}</p>
      : <p className="wk-card-muted">Ta grupa nie ma jeszcze rozmowy.</p>;
  }

  return (
    <>
      {chats.map((one) => (
        <section key={one.row.chatId} className="wk-seat-chat">
          {chats.length > 1 && <h3 className="wk-seat-who">{one.row.areaName}</h3>}
          <SeatChatRoom seat={seat} chat={one} identity={identity} />
        </section>
      ))}
      <p className="wk-hint">Czytają i piszą wszyscy z grupy — także kancelaria. Treść szyfruje Twoja przeglądarka.</p>
    </>
  );
}

function SeatChatRoom({ seat, chat, identity }: { seat: SeatView; chat: Ready; identity: SeatIdentity | null }) {
  const { token, seatId } = seat;
  const { chatId } = chat.row;
  const keys = chat.keys;
  const endpoint = chatEndpoint(chatId, token);
  const extras = useChatExtras(endpoint);
  const chrome = useChatChrome({ endpoint, extras, keys });

  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [name, setName] = useState(() => chatNameFor(seatId) ?? seat.recipientName ?? '');
  const [naming, setNaming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 0062 — worauf geantwortet und was bearbeitet wird. */
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const composer = useRef<ComposerHandle | null>(null);

  /* 0058 — die Geschichte, und bis wann Änderungen geholt sind. */
  const [history, setHistory] = useState<{
    load: () => Promise<{ versions: readonly SealedVersion[] }>;
    open: (version: SealedVersion) => Promise<Opened | null>;
  } | null>(null);
  const asOf = useRef<string | null>(null);

  const open = useCallback(async (messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(keys, message) }))), [keys]);

  /* 0059 — was sich an schon gezeigten Nachrichten geändert hat: an ihrer Stelle ersetzen. */
  const pullChanged = useCallback(async () => {
    if (asOf.current === null) return;
    const { messages, asOf: at } = await loadSeatMessages(token, chatId, { changed: asOf.current });
    if (at !== undefined) asOf.current = at;
    if (messages.length === 0) return;
    const opened = await open(messages);
    setShown((was) => (was ?? []).map((w) => opened.find((o) => o.message.messageId === w.message.messageId) ?? w));
  }, [token, chatId, open]);

  /* Das erste Bild — sobald der Schlüssel da ist. */
  useEffect(() => {
    if (keys.size === 0) return;
    let alive = true;
    void (async () => {
      try {
        const { messages, asOf: at } = await loadSeatMessages(token, chatId);
        const opened = await open(messages);
        if (!alive) return;
        asOf.current = at ?? null;
        setShown(opened);
        reportChatSeen(endpoint, opened[opened.length - 1]?.message.createdAt ?? null);
        setMore(messages.length >= 60);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać wiadomości.');
      }
    })();
    return () => { alive = false; };
  }, [token, chatId, keys, open]);

  /* Nachladen, alle paar Sekunden, solange die Seite sichtbar ist. */
  const list = shown ?? [];
  const last = list.length === 0 ? null : list[list.length - 1].message.createdAt;
  const lastId = list.length > 0 ? list[list.length - 1].message.messageId : undefined;
  const loaded = shown !== undefined;
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadSeatMessages(token, chatId, last === null ? {} : { after: last, afterId: lastId });
          if (messages.length > 0) {
            const opened = await open(messages);
            setShown((was) => [...(was ?? []), ...opened.filter((o) => !(was ?? []).some((w) => w.message.messageId === o.message.messageId))]);
          }
          reportChatSeen(endpoint, messages[messages.length - 1]?.createdAt ?? last);
          await pullChanged();
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loaded, token, chatId, last, lastId, open, pullChanged]);

  const earlier = useCallback(async () => {
    const first = shown?.[0];
    if (first === undefined) return;
    const { messages } = await loadSeatMessages(token, chatId, { before: first.message.createdAt, beforeId: first.message.messageId });
    const opened = await open(messages);
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  }, [token, chatId, shown, open]);

  if (keys.size === 0) {
    return (
      <p className="wk-note">
        Rozmowa grupy „{chat.row.areaName}" otworzy się tutaj, gdy tylko ktoś z prowadzących do niej
        zajrzy — wtedy jego przeglądarka przekaże Ci klucz. Strona sprawdza to sama; nie musisz nic robić.
      </p>
    );
  }

  const signed = name.trim();
  const mine = (message: SealedMessage) => message.authorSeatId === seatId;

  /* Wer schreibt: ich, ein anderer mit Link, oder jemand aus der Gruppe mit Konto. */
  const rules: MessageRules = {
    mine,
    author: (message, opened) => (mine(message) ? 'Ty' : opened?.name ?? (message.authorSeatId !== null ? 'osoba z linkiem' : 'prowadzący')),
    note: (message) => (message.authorSeatId !== null && !mine(message) ? 'z linku' : null),
    canEdit: (message, opened) => mine(message) && message.deletedAt === null && opened !== null && identity !== null,
    canDelete: (message) => mine(message) && message.deletedAt === null,
    canRestore: (message) => message.deletedAt !== null && mine(message) && message.deletedBy === 'author',
    canPin: false,
    group: true,
    receipts: true
  };

  const on: MessageHandlers = {
    reply: (message, opened, author) => { setEditing(null); setReply({ id: message.messageId, text: opened.text, author }); },
    edit: (message, opened) => { setReply(null); setEditing({ message, opened }); },
    remove: async (message) => {
      await deleteSeatMessage(token, message.messageId);
      setShown((was) => withDelete(was ?? [], message.messageId, 'author'));
    },
    restore: async (message) => { await restoreSeatMessage(token, message.messageId); await pullChanged(); },
    history: (message) => setHistory({
      load: () => loadSeatVersions(token, message.messageId),
      open: (version) => openVersion(keys, message.messageId, authorOf(message), version)
    })
  };

  const send = async (body: string, options: SendOptions) => {
    if (identity === null) throw new WorkspaceError('Rozmowa jeszcze się otwiera — spróbuj za chwilę.');
    keepChatName(seatId, signed);
    const done = await sendSeatMessage(token, seatId, chatId, keys, identity, body, signed, options);
    setNaming(false);
    if (options.sendAt === undefined) {
      setShown((was) => [...(was ?? []), {
        message: { messageId: done.messageId, authorRoleId: null, authorSeatId: seatId, epoch: done.epoch, bodySealed: '', createdAt: done.createdAt, deletedAt: null },
        opened: { text: body, name: signed, ...options }
      }]);
    }
  };

  const saveEdit = async (text: string) => {
    if (editing === null || identity === null) return;
    const { message, opened } = editing;
    const done = await editSeatMessage(token, seatId, message.messageId, keys, identity, text, opened.name, (message.version ?? 1) + 1, opened);
    setShown((was) => withEdit(was ?? [], message.messageId, done, text));
    setEditing(null);
  };

  const subtitle = chrome.status.typing ? <span className="ch-typing">ktoś pisze…</span>
    : chrome.status.channel ? `kanał grupy „${chat.row.areaName}"` : `grupa „${chat.row.areaName}"`;

  /* JAK SIĘ PODPISAĆ — nad polem, dopóki nie ma podpisu albo gdy ktoś chce go zmienić. */
  const nameBar = naming || signed === '' ? (
    <div className="ch-namebar">
      <label>
        <span>Jak się podpisać</span>
        <input value={name} maxLength={80} placeholder="np. Jan Kowalski" autoFocus={naming} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (name.trim() !== '') { keepChatName(seatId, name.trim()); setNaming(false); composer.current?.focus(); } } }} />
      </label>
      {signed !== '' && (
        <button type="button" className="wk-link-btn" onClick={() => { keepChatName(seatId, signed); setNaming(false); composer.current?.focus(); }}>Gotowe</button>
      )}
      <span className="wk-hint">Tę nazwę zobaczą inni przy Twoich wiadomościach.</span>
    </div>
  ) : null;

  return (
    <div className="ch-room is-embedded wk-seat-chat-room">
      <ChatHeader compact subtitle={subtitle} menu={chrome.items} search={extras.search} onSearch={extras.setSearch} quiet={chrome.status.quiet} />
      {chrome.banner}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}

      <ChatLog
        endpoint={endpoint}
        items={shown}
        features={extras.features}
        matches={extras.matches}
        rules={rules}
        on={on}
        more={more}
        onEarlier={earlier}
        empty="Jeszcze nikt nic nie napisał — możesz zacząć."
        onFiles={(files) => composer.current?.addFiles(files)}
        search={extras.search}
        filter={extras.filter}
      />

      <Composer
        ref={composer}
        endpoint={endpoint}
        readOnly={extras.features?.canWrite === false ? 'Ten kanał pozwala Ci tylko czytać.' : null}
        placeholder={signed !== '' ? `Wiadomość jako ${signed}` : 'Wiadomość'}
        reply={reply}
        onClearReply={() => setReply(null)}
        editing={editing === null ? null : { id: editing.message.messageId, text: editing.opened.text }}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={saveEdit}
        onSend={send}
        onEditLast={() => {
          const one = lastEditable(list, rules.canEdit);
          if (one !== null && one.opened !== null) on.edit(one.message, one.opened);
        }}
        onScheduled={chrome.scheduled.refresh}
        before={<>{nameBar}{chrome.chip}</>}
        blocked={signed === '' ? 'Najpierw wpisz, jak się podpisać.' : identity === null ? 'Rozmowa jeszcze się otwiera — spróbuj za chwilę.' : null}
        sendAs={signed !== '' && !naming ? (
          <button type="button" className="ch-sendas" aria-label={`Piszesz jako ${signed} — zmień podpis`} title={`Piszesz jako ${signed} — zmień podpis`}
            onClick={() => setNaming(true)}>
            <Avatar seed={seatId} name={signed} size="sm" />
          </button>
        ) : null}
      />

      {chrome.dialogs}
      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
    </div>
  );
}
