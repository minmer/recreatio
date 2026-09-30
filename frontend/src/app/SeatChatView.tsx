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

import { ChatToolbar, ComposerExtras, MessageContent, useChatExtras, useComposerExtras } from './ChatExtras';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { authorOf, openMessage, openVersion, type Opened, type SealedMessage, type SealedVersion } from './chat';
import { DeletedBody, EditBox, EditedMark, HistoryDialog, MessageTools } from './MessageBits';
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

interface Shown {
  readonly message: SealedMessage;
  readonly opened: Opened | null;
}

const when = (at: string) => {
  const d = new Date(at);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function SeatChatRoom({ seat, chat, identity }: { seat: SeatView; chat: Ready; identity: SeatIdentity | null }) {
  const { token, seatId } = seat;
  const { chatId } = chat.row;
  const keys = chat.keys;
  const endpoint = chatEndpoint(chatId, token);
  const extras = useChatExtras(endpoint);
  const compose = useComposerExtras(endpoint);

  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState(() => chatNameFor(seatId) ?? seat.recipientName ?? '');
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const log = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  /* 0058 — bearbeiten, die Geschichte, und bis wann Änderungen geholt sind. */
  const [editing, setEditing] = useState<string | null>(null);
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
  const last = shown === undefined || shown.length === 0 ? null : shown[shown.length - 1].message.createdAt;
  const lastId = shown && shown.length > 0 ? shown[shown.length - 1].message.messageId : undefined;
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

  useEffect(() => {
    const el = log.current;
    if (el !== null && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  if (keys.size === 0) {
    return (
      <p className="wk-note">
        Rozmowa grupy „{chat.row.areaName}" otworzy się tutaj, gdy tylko ktoś z prowadzących do niej
        zajrzy — wtedy jego przeglądarka przekaże Ci klucz. Strona sprawdza to sama; nie musisz nic robić.
      </p>
    );
  }

  const earlier = async () => {
    const first = shown?.[0]?.message.createdAt;
    if (first === undefined) return;
    const { messages } = await loadSeatMessages(token, chatId, { before: first, beforeId: shown?.[0]?.message.messageId });
    const opened = await open(messages);
    stick.current = false;
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  };

  const signed = name.trim();

  const send = async () => {
    const body = text.trim();
    if (extras.features?.canWrite === false) return;
    if ((body === '' && compose.files.length === 0) || busy || identity === null) return;
    if (signed === '') { setNaming(true); return; }
    setBusy(true);
    setFailed(null);
    try {
      keepChatName(seatId, signed);
      const options = await compose.prepare();
      const done = await sendSeatMessage(token, seatId, chatId, keys, identity, body, signed, options);
      stick.current = true;
      if (!options.sendAt) setShown((was) => [...(was ?? []), {
        message: {
          messageId: done.messageId, authorRoleId: null, authorSeatId: seatId, epoch: done.epoch,
          bodySealed: '', createdAt: done.createdAt, deletedAt: null
        },
        opened: { text: body, name: signed, ...options }
      }]);
      compose.done();
      setText('');
      setNaming(false);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };

  /* Wer schreibt: ich, ein anderer mit Link, oder jemand aus der Gruppe mit Konto. */
  const authorName = (message: SealedMessage, opened: Opened | null) =>
    message.authorSeatId === seatId ? 'Ty'
    : opened?.name ?? (message.authorSeatId !== null ? 'osoba z linkiem' : 'prowadzący');

  const list = shown ?? [];

  return (
    <div className="wk-chat-room wk-seat-chat-room">
      <ChatToolbar endpoint={endpoint} extras={extras} keys={keys} />
      <div
        className="wk-chat-log"
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {more && list.length > 0 && (
          <button type="button" className="wk-link-btn wk-chat-earlier" onClick={() => void earlier()}>
            Wczytaj wcześniejsze
          </button>
        )}
        {shown === undefined && <p className="wk-hint">Wczytywanie…</p>}
        {shown !== undefined && list.length === 0 && <p className="wk-empty">Jeszcze nikt nic nie napisał — możesz zacząć.</p>}

        {list.map(({ message, opened }, i) => {
          const id = message.messageId;
          if (!extras.matches(id, opened)) return null;
          const mine = message.authorSeatId === seatId;
          const prev = list[i - 1]?.message;
          const same = prev !== undefined && authorOf(prev) === authorOf(message)
            && new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

          return (
            <div id={`message-${message.messageId}`} key={message.messageId} className={`wk-msg${mine ? ' is-mine' : ''}${same ? ' is-follow' : ''}`}>
              {!same && (
                <p className="wk-msg-author">
                  {authorName(message, opened)}
                  <span className="wk-msg-time"> · {when(message.createdAt)}</span>
                </p>
              )}
              <div className="wk-msg-body">
                {message.deletedAt !== null ? (
                  <DeletedBody message={message} canRestore={mine && message.deletedBy === 'author'}
                    onRestore={async () => { await restoreSeatMessage(token, message.messageId); await pullChanged(); }} />
                ) : editing === message.messageId && opened !== null && identity !== null ? (
                  <EditBox initial={opened.text} onCancel={() => setEditing(null)} onSave={async (text) => {
                    const id = message.messageId;
                    const done = await editSeatMessage(token, seatId, id, keys, identity, text, opened.name, (message.version ?? 1) + 1, opened);
                    setShown((was) => (was ?? []).map((w) => w.message.messageId === id
                      ? { message: { ...w.message, version: done.version, editedAt: done.editedAt, epoch: done.epoch, bodySealed: done.bodySealed },
                          opened: { ...opened, text, name: opened.name } }
                      : w));
                    setEditing(null);
                  }} />
                ) : opened === null ? (
                  <em className="wk-row-side">Nie do odczytania.</em>
                ) : (
                  <>
                    <MessageContent endpoint={endpoint} id={id} opened={opened} features={extras.features} sentAt={message.createdAt} />
                    <EditedMark message={message} onOpen={() => setHistory({
                      load: () => loadSeatVersions(token, message.messageId),
                      open: (version) => openVersion(keys, message.messageId, authorOf(message), version)
                    })} />
                  </>
                )}
                {editing !== message.messageId && (
                  <MessageTools canEdit={mine && message.deletedAt === null && opened !== null && identity !== null}
                    canDelete={mine && message.deletedAt === null}
                    onEdit={() => setEditing(message.messageId)}
                    onDelete={() => {
                      if (!window.confirm('Usunąć tę wiadomość? Inni zobaczą, że była, ale nie jej treść. Możesz ją później przywrócić.')) return;
                      void deleteSeatMessage(token, message.messageId).then(() => setShown((was) => (was ?? []).map((w) =>
                        w.message.messageId === message.messageId
                          ? { message: { ...w.message, deletedAt: new Date().toISOString(), bodySealed: null, deletedBy: 'author' }, opened: null }
                          : w)));
                    }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {extras.features?.canWrite === false ? <p>Ten kanał pozwala Ci tylko czytać.</p> : <form className="wk-chat-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {naming || signed === '' ? (
          <label className="wk-field">
            <span>Jak się podpisać</span>
            <input value={name} maxLength={80} placeholder="np. Jan Kowalski" onChange={(e) => setName(e.target.value)} />
            <span className="wk-hint">Tę nazwę zobaczą inni przy Twoich wiadomościach.</span>
          </label>
        ) : (
          <p className="wk-hint">
            Piszesz jako <strong>{signed}</strong>{' '}
            <button type="button" className="wk-link-btn" onClick={() => setNaming(true)}>zmień</button>
          </p>
        )}
        <ComposerExtras state={compose} busy={busy} />
      <div className="wk-chat-compose-row">
          <textarea
            value={text}
            rows={2}
            placeholder="Napisz wiadomość… (Enter wysyła, Shift+Enter — nowa linia)"
            aria-label="Wiadomość"
            onChange={(e) => { setText(e.target.value); compose.typing(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          />
          <button type="submit" className="wk-btn" disabled={busy || (text.trim() === '' && compose.files.length === 0) || signed === ''}>
            {busy ? 'Wysyłanie…' : 'Wyślij'}
          </button>
        </div>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </form>}

      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
    </div>
  );
}
