/**
 * MIT DEM LINK IN DIE ROZMOWA (0095) — ohne Konto.
 *
 * <code>
 *   VisitorChat        der Baustein „Rozmowa" für jemanden ohne Konto: eine Person
 *                      dieses Browsers, die schon dabei ist (aus dem Formular oder
 *                      vorgestellt) — sonst, wenn ein Link die Rozmowa öffnet, LESEN
 *   LinkChatRoom       lesen über den Link, ohne Person; schreiben erst vorgestellt
 *   LinkChatsSection   auf der Seite des Links (#/dolacz/…): seine Rozmowy, je mit der
 *                      eigenen Person, zum Lesen oder zum Vorstellen
 * </code>
 *
 * <b>Lesen braucht keine Person</b> — wer den Bereich über den Link liest,
 * liest seine Rozmowa. Eine Person braucht es zum Schreiben.
 *
 * Wer sich vorstellt, wird eine Person des Links (`linkPerson.ts`) — in der
 * Rozmowa „Imię Nazwisko (Link)".
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { chatKeysOf, openMessage, openNames, type SealedMessage } from './chat';
import { authorText, messageAuthor } from './chatAuthor';
import { chatEndpoint } from './chatFeatures';
import { ChatHeader, type Shown } from './ChatKit';
import { ChatLog, type MessageHandlers, type MessageRules } from './ChatLog';
import { heldLinkKeys } from '../links/linkAccess';
import {
  createLinkPerson, linkChats, loadLinkChat, loadLinkMessages, personFor, portalOf, type HeldPerson, type LinkChat, type LinkChatDetail
} from '../links/linkPerson';
import type { SeatView } from '../seats/seatContext';
import { SeatChatBody } from './SeatChatView';
import { loadSeatChats } from '../seats/seatChat';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import { rich, useT } from '../core/i18n';

/** Imię, nazwisko — und „Dołącz". */
export function IntroduceToChat({ chat, under, onJoined }: {
  chat: LinkChat;
  under: string | null;
  onJoined: (person: HeldPerson) => void;
}) {
  const t = useT();
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const shown = `${given.trim() || t('chat.link.given')} ${surname.trim() || t('chat.link.surname')} (${chat.label})`;

  const join = async () => {
    setBusy(true);
    setFailed(null);
    try {
      onJoined(await createLinkPerson(chat, given, surname, under));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('chat.link.joinFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-form wk-introduce" data-link-introduce={chat.chatId} onSubmit={(e) => { e.preventDefault(); void join(); }}>
      <p className="wk-hint">
        {rich(t(chat.kind === 'channel' ? 'chat.link.introChannel' : 'chat.link.introChat', { label: chat.label, area: chat.areaName, shown }), { b: (s, k) => <strong key={k}>{s}</strong> })}
      </p>
      <label className="wk-field">
        <span>{t('chat.link.given')}</span>
        <input value={given} maxLength={80} autoComplete="given-name" data-introduce-given="" onChange={(e) => setGiven(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>{t('chat.link.surname')}</span>
        <input value={surname} maxLength={100} autoComplete="family-name" data-introduce-surname="" onChange={(e) => setSurname(e.target.value)} />
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" data-introduce-go="" disabled={busy || given.trim() === '' || surname.trim() === ''}>
          {busy ? t('chat.link.joining') : t('chat.link.joinChat')}
        </button>
      </div>
      <p className="wk-hint">{t('chat.link.staysHere')}</p>
    </form>
  );
}

/**
 * DER BAUSTEIN „ROZMOWA" FÜR JEMANDEN OHNE KONTO. Zuerst die oben gewählte
 * Person, dann jede andere dieses Browsers, die in die Rozmowa kommt — wer aus
 * dem Formular zu ihr gehört, spricht als er (0095: „die Person aus dem
 * Formular wird genommen"). Sonst, wenn ein Link sie öffnet: sich vorstellen.
 */
export function VisitorChat({ chatId, seats, chosen, under, fallback }: {
  chatId: string;
  seats: readonly SeatView[];
  chosen: SeatView | null;
  under: string | null;
  fallback: ReactNode;
}) {
  /*
   * Gemerkt wird nur WELCHER Platz (sein Token) — der Platz selbst kommt bei
   * jedem Zeichnen frisch aus der Seite. Sonst baute jedes Nachladen der Seite
   * die Rozmowa neu auf, und was gerade getippt wurde, wäre fort.
   */
  const t = useT();
  const [found, setFound] = useState<{ token: string | null; link: boolean } | undefined>(undefined);
  const order = chosen === null ? seats : [chosen, ...seats.filter((one) => one.token !== chosen.token)];
  const stamp = order.map((one) => `${one.token}:${one.seatKey === null ? 0 : 1}`).join(',');

  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const seat of order) {
        if (seat.seatKey === null) continue;
        try {
          if ((await loadSeatChats(seat.token)).chats.some((one) => one.chatId === chatId)) {
            if (alive) setFound((was) => (was?.token === seat.token ? was : { token: seat.token, link: false }));
            return;
          }
        } catch {
          // Ein Platz, der nicht mehr gilt, kommt nirgends hin.
        }
      }
      /* Keine eigene Person darin: liest ein Link dieses Browsers die Rozmowa? Dann lesen. */
      const link = (await loadLinkChat(chatId)) !== null;
      if (alive) setFound((was) => (was?.token === null && was.link === link ? was : { token: null, link }));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, stamp]);

  if (found === undefined) return <Loading label={t('chat.link.loading')} />;

  const seat = found.token === null ? undefined : order.find((one) => one.token === found.token);
  if (seat !== undefined) {
    return (
      <>
        {chosen !== null && seat.token !== chosen.token && (
          <p className="ch-note">{rich(t('chat.link.writingAs', { name: seat.recipientName ?? t('chat.author.linkPerson') }), { b: (s, k) => <strong key={k}>{s}</strong> })}</p>
        )}
        <SeatChatBody seat={seat} only={chatId} />
      </>
    );
  }

  if (found.link) {
    /* Lesen über den Link; nach dem Vorstellen liest die Seite ihre Plätze neu (`announceSeats`) — dann schreibt man hier. */
    return <LinkChatRoom chatId={chatId} under={under} onJoined={() => setFound(undefined)} />;
  }

  return <>{fallback}</>;
}

/**
 * LESEN ÜBER DEN LINK, OHNE PERSON — der Verlauf, wie ihn ein Mitglied sieht,
 * nur ohne Antworten, Reaktionen und Feld. Darunter, wo man mitschreiben kann
 * (die Rozmowa des Bereichs): „Przedstaw się". Im Kanał und in einer Gruppe
 * liest der Link nur.
 */
export function LinkChatRoom({ chatId, under, onJoined, signedIn = false }: {
  chatId: string;
  under: string | null;
  onJoined: (person: HeldPerson) => void;
  /** Angemeldet: das Konto liest hier nicht, ein Link im Browser schon — schreiben heisst dann, ihn ins Konto aufzunehmen. */
  signedIn?: boolean;
}) {
  const t = useT();
  const [detail, setDetail] = useState<LinkChatDetail | null | undefined>(undefined);
  const [talk, setTalk] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState('');
  const asOf = useRef<string | null>(null);

  const open = useCallback(async (keys: ReadonlyMap<number, Uint8Array>, messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(keys, message) }))), []);

  /* Die Rozmowa, ihre Schlüssel (aus dem Link), die Namen, die letzten Nachrichten. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const found = await loadLinkChat(chatId);
      if (found === null) { if (alive) setDetail(null); return; }
      const area = (await heldLinkKeys()).areaKeys.get(found.areaId) ?? new Map<number, Uint8Array>();
      const keys = await chatKeysOf(chatId, area);
      const known = await openNames(area, found.areaId, found.names);
      const { messages, asOf: at } = await loadLinkMessages(chatId);
      const opened = await open(keys, messages);
      if (!alive) return;
      asOf.current = at ?? null;
      setDetail(found);
      setTalk(keys);
      setNames(known);
      setShown(opened);
      setMore(messages.length >= 60);
    })().catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [chatId, open]);

  /* Nachladen, solange die Seite sichtbar ist: das Neue, und was sich geändert hat. */
  const list = shown ?? [];
  const last = list.length === 0 ? null : list[list.length - 1].message;
  useEffect(() => {
    if (detail == null) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadLinkMessages(chatId, last === null ? {} : { after: last.createdAt, afterId: last.messageId });
          if (messages.length > 0) {
            const opened = await open(talk, messages);
            setShown((was) => [...(was ?? []), ...opened.filter((o) => !(was ?? []).some((w) => w.message.messageId === o.message.messageId))]);
          }
          if (asOf.current !== null) {
            const changed = await loadLinkMessages(chatId, { changed: asOf.current });
            if (changed.asOf !== undefined) asOf.current = changed.asOf;
            if (changed.messages.length > 0) {
              const opened = await open(talk, changed.messages);
              setShown((was) => (was ?? []).map((w) => opened.find((o) => o.message.messageId === w.message.messageId) ?? w));
            }
          }
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detail, chatId, last, talk, open]);

  const earlier = useCallback(async () => {
    const first = shown?.[0];
    if (first === undefined) return;
    const { messages } = await loadLinkMessages(chatId, { before: first.message.createdAt, beforeId: first.message.messageId });
    const opened = await open(talk, messages);
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  }, [chatId, shown, talk, open]);

  if (detail === undefined) return <Loading label={t('chat.link.loading')} />;
  if (detail === null) return <p className="wk-card-muted">{t('chat.link.notOpen')}</p>;

  const rules: MessageRules = {
    mine: () => false,
    author: (message, opened) => authorText(messageAuthor(message, opened, {
      name: (id) => names.get(id),
      seat: (seatId) => detail.seats.find((one) => one.seatId === seatId)
    })),
    note: (message) => (message.authorSeatId !== null ? t('chat.link.fromLink') : null),
    canEdit: () => false,
    canDelete: () => false,
    canRestore: () => false,
    canPin: false,
    group: true,
    receipts: false,
    readOnly: true
  };
  const nothing = () => undefined;
  const on: MessageHandlers = { reply: nothing, edit: nothing, remove: async () => undefined, restore: async () => undefined, history: nothing };
  const needle = search.trim().toLowerCase();

  return (
    <div className="ch-room is-embedded wk-link-room" data-link-room={chatId}>
      <ChatHeader compact menu={[]} search={search} onSearch={setSearch}
        subtitle={t(detail.kind === 'channel' ? 'chat.link.subChannel' : detail.kind === 'group' ? 'chat.link.subGroup' : 'chat.link.subChat', { area: detail.areaName, label: detail.label })} />
      <ChatLog
        endpoint={chatEndpoint(chatId)}
        items={shown}
        features={null}
        matches={(_id, opened) => needle === '' || (opened?.text ?? '').toLowerCase().includes(needle)}
        rules={rules}
        on={on}
        more={more}
        onEarlier={earlier}
        empty={t('chat.link.empty')}
        search={search}
      />
      {signedIn ? (
        <p className="wk-link-read-bar" data-link-read-bar="">
          {t('chat.link.signedInBar', { label: detail.label })}
        </p>
      ) : detail.joinable ? (
        joining ? (
          <IntroduceToChat chat={detail} under={under} onJoined={onJoined} />
        ) : (
          <div className="wk-link-read-bar" data-link-read-bar="">
            <span>{t('chat.link.guestBar', { label: detail.label })}</span>
            <button type="button" className="wk-btn wk-btn-small" data-link-join="" onClick={() => setJoining(true)}>{t('chat.link.introduce')}</button>
          </div>
        )
      ) : (
        <p className="wk-link-read-bar" data-link-read-bar="">
          {detail.kind === 'channel' ? t('chat.link.readChannel') : t('chat.link.readGroup')}
        </p>
      )}
    </div>
  );
}

/**
 * AUF DER SEITE DES LINKS: die Rozmowy, die er öffnet — mit der eigenen Person
 * (dann „Otwórz rozmowę") oder dem Vorstellen. Danach führt der Weg in die
 * Ansicht dieser Person, wo ihre Rozmowy stehen.
 */
export function LinkChatsSection({ invitationId }: { invitationId: string }) {
  const t = useT();
  const [chats, setChats] = useState<readonly LinkChat[] | null>(null);
  const [persons, setPersons] = useState<ReadonlyMap<string, HeldPerson | null>>(new Map());
  const [joining, setJoining] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const mine = (await linkChats().catch(() => [])).filter((one) => one.invitationId === invitationId);
      const found = new Map<string, HeldPerson | null>();
      for (const one of mine) found.set(one.chatId, await personFor(one.chatId));
      if (alive) { setChats(mine); setPersons(found); }
    })();
    return () => { alive = false; };
  }, [invitationId]);

  if (chats === null || chats.length === 0) return null;

  return (
    <section className="wk-link-chats" data-link-chats="">
      <h2 className="wk-h2">{t('chat.head.chats')}</h2>
      <ul className="wk-link-chat-list">
        {chats.map((one) => {
          const person = persons.get(one.chatId) ?? null;
          return (
            <li key={one.chatId} data-link-chat={one.chatId}>
              <span><strong>{one.kind === 'channel' ? t('chat.title.channel', { name: one.areaName }) : one.areaName}</strong></span>
              {person !== null ? (
                <a className="wk-btn wk-btn-small" href={portalOf(person)}>{t('chat.link.openChat')}</a>
              ) : (
                <span className="wk-actions">
                  {reading !== one.chatId && (
                    <button type="button" className={one.joinable ? 'wk-link-btn' : 'wk-btn wk-btn-small'} data-link-read="" onClick={() => { setReading(one.chatId); setJoining(null); }}>{t('chat.link.read')}</button>
                  )}
                  {one.joinable && joining !== one.chatId && (
                    <button type="button" className="wk-btn wk-btn-small" onClick={() => { setJoining(one.chatId); setReading(null); }}>{t('chat.link.join')}</button>
                  )}
                </span>
              )}
              {reading === one.chatId && person === null && (
                <LinkChatRoom chatId={one.chatId} under={null} onJoined={(made) => { window.location.hash = portalOf(made).slice(1); }} />
              )}
              {joining === one.chatId && person === null && (
                <IntroduceToChat chat={one} under={null} onJoined={(made) => { window.location.hash = portalOf(made).slice(1); }} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default VisitorChat;
