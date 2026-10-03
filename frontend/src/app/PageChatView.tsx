/**
 * DIE ROZMOWA ALS BAUSTEIN EINER SEITE (0053).
 *
 * <b>Dieselbe Rozmowa, ein anderer Ort.</b> Sie liegt am Kern eines Bereichs;
 * wer den Bereich hält, liest und schreibt — ob er das im Arbeitsplatz tut
 * oder auf der Seite, an der die Gruppe ohnehin arbeitet, ist ihr gleich.
 *
 * <b>Drei Besucher, drei Antworten.</b> Die Seite ist öffentlich; die Rozmowa
 * ist es nicht:
 *
 * <code>
 *   angemeldet, im Bereich   die Rozmowa, zum Lesen und Schreiben
 *   mit persönlichem Link    dieselbe, über seinen Platz (`SeatChatBody`)
 *   ein Besucher             der Satz, dass es dafür einen Zugang braucht
 * </code>
 *
 * <b>Der Dienst entscheidet, nicht diese Datei.</b> Wer nicht hineindarf,
 * bekommt vom Dienst kein Wort davon — und die Schlüssel hätte er ohnehin
 * nicht. Was hier steht, ist nur die Frage, WELCHEN Weg der Browser versucht.
 *
 * <b>Wer hereinschaut, gibt weiter.</b> Wie im Arbeitsplatz: sieht ein
 * Mitglied die Rozmowa, verpackt sein Browser den Chatschlüssel für die
 * Menschen mit Link, die noch auf ihn warten. Sonst hinge deren Zugang daran,
 * dass jemand an den Arbeitsplatz denkt.
 */

import { ForwardDialog, useChatExtras } from './ChatExtras';
import {
  ChatHeader, ChatLog, Composer, lastEditable, plural, SendAs, useChatChrome, withDelete, withEdit,
  type ComposerHandle, type MessageHandlers, type MessageRules, type ReplyTarget, type Shown
} from './ChatKit';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  areaKeys, authorOf, chatKeysOf, deleteMessage, deliverSeatKeys, editMessage, keyHolderOf, loadChat, loadMessages, loadVersions,
  markRead, openMessage, openNames, openVersion, restoreMessage, sendMessage, fixedPolicy,
  type ChatDetail, type Opened, type SealedMessage, type SealedVersion, type SendOptions
} from './chat';
import type { Ring } from './keys';
import { HistoryDialog } from './MessageBits';
import { usePerson, type PagePerson } from './pagePerson';
import { useRemembered } from './prefs';
import { myRoleNames } from './roleNames';
import { SeatChatBody } from './SeatChatView';
import { whoIsThere, WorkspaceError } from './session';

type RolePerson = Extract<PagePerson, { kind: 'role' }>;

/**
 * Der Baustein selbst: die Überschrift, und darunter das, was dieser Besucher
 * sehen darf.
 *
 * <b>Auch ohne Wahl oben.</b> Steht in der Personenauswahl niemand, ist der
 * Besucher trotzdem vielleicht angemeldet — dann gilt seine erste eigene
 * Person. Die Wahl oben sagt, FÜR WEN gehandelt wird; zum Mitreden in einer
 * Gruppe braucht es sie nicht.
 */
export function PageChatCard({ title, chatId }: { title: string; chatId: string }) {
  const person = usePerson();
  const head = <h2 className="wk-card-title">{title.trim() === '' ? 'Rozmowa' : title}</h2>;

  if (chatId === '') {
    return <>{head}<p className="wk-card-muted">Tu pojawi się rozmowa grupy — trzeba ją jeszcze wybrać.</p></>;
  }

  const chosen = person?.chosen ?? null;

  /* Der Mensch mit dem Link: seine Rozmowa hängt an seinem Platz, nicht an einem Schlüssel von hier. */
  if (chosen?.kind === 'seat') {
    return <>{head}<SeatChatBody seat={chosen.seat} only={chatId} /></>;
  }

  const role: RolePerson | null = chosen?.kind === 'role'
    ? chosen
    : person?.options.find((one): one is RolePerson => one.kind === 'role') ?? null;

  if (role === null) {
    return (
      <>
        {head}
        <p className="wk-card-muted">
          {person?.loading === true
            ? 'Wczytywanie…'
            : 'Ta rozmowa należy do grupy. Zaloguj się albo otwórz swój osobisty link — wtedy pojawi się tutaj.'}
        </p>
      </>
    );
  }

  return <>{head}<PageChatRoom key={chatId} chatId={chatId} ring={role.ring} asRoleId={role.id} /></>;
}

/* -- Die Rozmowa für jemanden mit Konto ------------------------------------ */

export function PageChatRoom({ chatId, ring, asRoleId }: { chatId: string; ring: Ring; asRoleId: string }) {
  const [chat, setChat] = useState<ChatDetail | null | undefined>(undefined);
  const [talk, setTalk] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
     WER HIER SCHREIBT — links neben dem Feld (Telegram: „Wyślij jako"), samt
     Wahl, wenn es mehr als eine gibt, und im Feld selbst („Wiadomość jako …").
     Bisher wählte die Seite still: die oben gewählte Person, sonst irgendeine
     eigene Rolle, die schreiben darf. Wer dann als „Rada" statt als er selbst
     schrieb, erfuhr es erst aus der Antwort — und im Vollbild sieht man die
     Wahl oben gar nicht.

     Wer schreiben darf, sagt der Dienst (`writers`); wofür ich unterschreiben
     kann, der Schlüsselbund. Eine Wahl HIER merkt sich die Rozmowa —
     versiegelt, je Rozmowa, im Arbeitsplatz und auf der Seite dieselbe
     (`chat.as.<id>`); ohne sie gilt die oben gewählte Person.
  */
  const person = usePerson();
  const [picked, pick] = useRemembered(`chat.as.${chatId}`, '');
  const endpoint = chatEndpoint(chatId);
  const extras = useChatExtras(endpoint);

  /* 0062 — worauf geantwortet, was bearbeitet, was weitergegeben wird. */
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const [forward, setForward] = useState<Opened | null>(null);
  const [unreadAfter, setUnreadAfter] = useState<string | null | undefined>(undefined);
  const composer = useRef<ComposerHandle | null>(null);

  /* 0058 — die Geschichte, und bis wann Änderungen geholt sind. */
  const [history, setHistory] = useState<{
    load: () => Promise<{ versions: readonly SealedVersion[] }>;
    open: (version: SealedVersion) => Promise<Opened | null>;
  } | null>(null);
  const asOf = useRef<string | null>(null);
  const [own, setOwn] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    void whoIsThere()
      .then((who) => (who === null ? new Map<string, string>() : myRoleNames(who)))
      .then((found) => { if (alive) setOwn(found); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const persons = new Map((person?.options ?? [])
    .filter((one): one is RolePerson => one.kind === 'role')
    .map((one) => [one.id, one.name] as const));

  /* Wie mich die Gruppe sieht: der Name, den sie von mir kennt; sonst der meiner Person oder Rolle. */
  const nameOf = (id: string): string | null => names.get(id) ?? persons.get(id) ?? own.get(id) ?? null;

  /* Die eigenen Personen zuerst, dann die Rollen — so steht man selbst oben in der Wahl. */
  const speakers = chat == null ? []
    : chat.writers.filter((id) => ring.maySign(id)).sort((a, b) => Number(persons.has(b)) - Number(persons.has(a)));
  const speaker = (speakers.includes(picked) ? picked : null)
    ?? (speakers.includes(asRoleId) ? asRoleId : null)
    ?? speakers.find((id) => persons.has(id))
    ?? speakers[0]
    ?? null;

  const look = useCallback(async (fresh = false) => {
    try {
      const found = await loadChat(chatId);
      const held = await areaKeys(ring, found.areaId, fresh);
      const derived = await chatKeysOf(found.chatId, held);
      setChat(found);
      setTalk(derived);
      setNames(await openNames(held, found.areaId, found.names));
      setUnreadAfter((was) => (was === undefined ? found.readAt : was));

      /* Wer mit Link wartet, bekommt seinen Schlüssel, sobald ein Mitglied hereinschaut. */
      const by = keyHolderOf(found, ring);
      if (by !== undefined && found.seats.some((one) => one.wrapPublicKey !== null && !one.epochs.includes(found.currentEpoch))) {
        void deliverSeatKeys(found, held, by).catch(() => undefined);
      }
      return derived;
    } catch (e) {
      setChat(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
      return null;
    }
  }, [chatId, ring]);

  const open = useCallback(async (keys: ReadonlyMap<number, Uint8Array>, messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(keys, message) }))), []);

  /* Das erste Bild. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const keys = await look();
      if (keys === null || !alive) return;
      const { messages, asOf: at } = await loadMessages(chatId);
      const opened = await open(keys, messages);
      if (!alive) return;
      asOf.current = at ?? null;
      setShown(opened);
      reportChatSeen(endpoint, opened[opened.length - 1]?.message.createdAt ?? null);
      setMore(messages.length >= 60);
      void markRead(chatId).catch(() => undefined);
    })();
    return () => { alive = false; };
  }, [chatId, look, open]);

  /* 0059 — was sich an schon gezeigten Nachrichten geändert hat: an ihrer Stelle ersetzen. */
  const pullChanged = useCallback(async (keys: ReadonlyMap<number, Uint8Array>) => {
    if (asOf.current === null) return;
    const { messages, asOf: at } = await loadMessages(chatId, { changed: asOf.current });
    if (at !== undefined) asOf.current = at;
    if (messages.length === 0) return;
    const opened = await open(keys, messages);
    setShown((was) => (was ?? []).map((w) => opened.find((o) => o.message.messageId === w.message.messageId) ?? w));
  }, [chatId, open]);

  /* Nachladen, solange die Seite sichtbar ist. Eine unbekannte Epoche holt neue Schlüssel. */
  const list = shown ?? [];
  const last = list.length === 0 ? null : list[list.length - 1].message.createdAt;
  const lastId = list.length > 0 ? list[list.length - 1].message.messageId : undefined;
  const ready = chat != null;
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadMessages(chatId, last === null ? {} : { after: last, afterId: lastId });
          const keys = messages.some((m) => !talk.has(m.epoch)) ? (await look(true)) ?? talk : talk;
          if (messages.length > 0) {
            const opened = await open(keys, messages);
            setShown((was) => [...(was ?? []), ...opened.filter((o) => !(was ?? []).some((w) => w.message.messageId === o.message.messageId))]);
          }
          reportChatSeen(endpoint, messages[messages.length - 1]?.createdAt ?? last);
          await pullChanged(keys);
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [ready, chatId, last, lastId, talk, look, open, pullChanged]);

  const earlier = useCallback(async () => {
    const first = shown?.[0];
    if (first === undefined) return;
    const { messages } = await loadMessages(chatId, { before: first.message.createdAt, beforeId: first.message.messageId });
    const opened = await open(talk, messages);
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  }, [chatId, shown, talk, open]);

  const moderates = (chat?.certifiers.length ?? 0) > 0 && chat?.kind !== 'direct';
  /* 0080 — in der Rozmowa des Bereichs und im Kanał sagt die Art, wer schreibt. */
  const chrome = useChatChrome({ endpoint, extras, keys: talk, canModerate: moderates && chat != null && !fixedPolicy(chat.kind), onPolicy: () => void look() });

  if (chat === undefined) return <p className="wk-card-muted">Wczytywanie rozmowy…</p>;
  if (chat === null) {
    return <p className="wk-card-muted">{failed ?? 'Ta rozmowa nie jest dla Ciebie — albo już jej nie ma.'}</p>;
  }

  const mine = (message: SealedMessage) => message.authorRoleId !== null && ring.has(message.authorRoleId);
  const label = (id: string) => nameOf(id) ?? `rola ${id.slice(0, 8)}`;

  const authorName = (message: SealedMessage, opened: Opened | null): string => {
    const id = message.authorRoleId;
    if (id === null) return opened?.name ?? 'osoba z linkiem';

    /* Meine eigenen: mit dem Namen, unter dem sie hinausgingen — ich schreibe vielleicht als mehr als eine Rolle. */
    if (ring.has(id)) {
      const as = nameOf(id) ?? opened?.name ?? null;
      return as === null || speakers.length < 2 ? 'Ty' : `${as} (Ty)`;
    }

    return names.get(id) ?? opened?.name ?? 'ktoś z grupy';
  };

  const rules: MessageRules = {
    mine,
    author: authorName,
    note: (message) => (message.authorSeatId !== null ? 'z linku' : null),
    canEdit: (message, opened) => mine(message) && message.deletedAt === null && opened !== null && speakers.includes(message.authorRoleId ?? ''),
    canDelete: (message) => mine(message) && message.deletedAt === null,
    canRestore: (message) => message.deletedAt !== null && mine(message) && message.deletedBy === 'author',
    canPin: moderates,
    group: chat.kind !== 'direct' && chat.kind !== 'self',
    receipts: chat.kind !== 'self'
  };

  const on: MessageHandlers = {
    reply: (message, opened, author) => { setEditing(null); setReply({ id: message.messageId, text: opened.text, author }); },
    edit: (message, opened) => { setReply(null); setEditing({ message, opened }); },
    remove: async (message) => {
      await deleteMessage(message.messageId);
      setShown((was) => withDelete(was ?? [], message.messageId, 'author'));
    },
    restore: async (message) => { await restoreMessage(message.messageId); await pullChanged(talk); },
    history: (message) => setHistory({
      load: () => loadVersions(message.messageId),
      open: (version) => openVersion(talk, message.messageId, authorOf(message), version)
    }),
    forward: (opened) => setForward(opened)
  };

  const send = async (body: string, options: SendOptions) => {
    if (speaker === null) throw new WorkspaceError('W tej rozmowie tylko czytasz.');
    /* Der Name reist in der Nachricht mit — für die, die die Namen des Bereichs nicht lesen (0053). */
    const name = nameOf(speaker);
    const done = await sendMessage(ring, chatId, talk, speaker, body, name, options);
    if (options.sendAt === undefined) {
      setShown((was) => [...(was ?? []), {
        message: { messageId: done.messageId, authorRoleId: speaker, authorSeatId: null, epoch: done.epoch, bodySealed: '', createdAt: done.createdAt, deletedAt: null },
        opened: { text: body, name, ...options }
      }]);
    }
  };

  const saveEdit = async (text: string) => {
    if (editing === null) return;
    const { message, opened } = editing;
    const done = await editMessage(ring, message.messageId, talk, message.authorRoleId!, text, opened.name, (message.version ?? 1) + 1, opened);
    setShown((was) => withEdit(was ?? [], message.messageId, done, text));
    setEditing(null);
  };

  const n = chat.members.length;
  const subtitle = chrome.status.typing ? <span className="ch-typing">ktoś pisze…</span> : [
    `${n} ${plural(n, 'uczestnik', 'uczestnicy', 'uczestników')}`,
    chat.seats.length > 0 ? `${chat.seats.length} z linkiem` : null,
    chrome.status.channel ? 'kanał' : null
  ].filter(Boolean).join(' · ');

  /* Die oben gewählte Person, wenn SIE hier nicht schreiben darf — damit niemand glaubt, er schreibe als sie. */
  const asked = speaker !== null && speaker !== asRoleId && !speakers.includes(asRoleId) && persons.has(asRoleId) ? persons.get(asRoleId)! : null;

  return (
    <div className="ch-room is-embedded">
      <ChatHeader compact subtitle={subtitle} menu={chrome.items} search={extras.search} onSearch={extras.setSearch} quiet={chrome.status.quiet} />
      {chrome.banner}

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
        unreadAfter={unreadAfter ?? null}
        search={extras.search}
        filter={extras.filter}
      />

      <Composer
        ref={composer}
        endpoint={endpoint}
        readOnly={speaker === null ? 'W tej rozmowie tylko czytasz.' : extras.features?.canWrite === false ? 'Ten kanał pozwala Ci tylko czytać.' : null}
        placeholder={speaker !== null && speakers.length > 1 ? `Wiadomość jako ${label(speaker)}` : 'Wiadomość'}
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
        before={<>
          {asked !== null && <p className="ch-note">{asked} nie pisze w tej grupie — piszesz jako <strong>{label(speaker!)}</strong>.</p>}
          {chrome.chip}
        </>}
        sendAs={speaker !== null && speakers.length > 1 ? <SendAs speakers={speakers} speaker={speaker} nameOf={label} onPick={pick} /> : null}
      />

      {chrome.dialogs}
      {forward !== null && <ForwardDialog endpoint={endpoint} opened={forward} ring={ring} onClose={() => setForward(null)} />}
      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}
    </div>
  );
}

export default PageChatCard;
