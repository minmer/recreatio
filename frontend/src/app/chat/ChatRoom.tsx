/**
 * Eine Rozmowa: Nachrichten, Schreiben, Themen, Aufgaben und Termine aus einer Nachricht; „Usuń rozmowę".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type CalendarRow, loadCalendars } from '../calendar/calendar';
import { EventDialog } from '../calendar/EventDialog';
import { TaskDialog } from '../calendar/TaskDialog';
import type { Me as Person } from '../core/me';
import { plural } from '../core/plural';
import { useRemembered } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { nameOf } from '../roles/RolePicker';
import { viewPath } from '../routes';
import { later } from '../ui/later';
import { Modal } from '../ui/Modal';
import { CHATS_CHANGED, type ChatDetail, type Opened, type SealedMessage, type SealedVersion, type SendOptions, areaKeys, authorOf, chatKeysOf, deleteMessage, deliverSeatKeys, editMessage, fixedPolicy, keyHolderOf, loadChat, loadMessages, loadVersions, markRead, openMessage, openNames, openVersion, removeChat, restoreMessage, sendMessage, setMemberName } from './chat';
import { authorText, chooseSpeaker, isMine, messageAuthor, speakerKey, speakerText, speakersOf, throughRole } from './chatAuthor';
import { useChatChrome } from './ChatChrome';
import { ForwardDialog, useChatExtras } from './ChatExtras';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { Avatar, ChatHeader, type MenuItem, type Shown } from './ChatKit';
import { ChatLog, type MessageHandlers, type MessageRules, lastEditable, withDelete, withEdit } from './ChatLog';
import { ChatSettings } from './ChatSettings';
import { type Me, titleOfArea, useAreas } from './chatShared';
import { type Topic, collectToTopic, createTopic, loadTopics, openTopics, titleFrom } from './chatTopics';
import { Composer, type ComposerHandle, type ReplyTarget } from './Composer';
import { HistoryDialog } from './MessageBits';
import { SpeakerPick } from './SpeakerPick';
import { CollectToTopic, LinkedDialog, TopicBar } from './TopicBar';

/* 2026-10-29 — „Rozmowa jako JSON" erst, wenn jemand es öffnet: das Fach zieht den Leser der Seiten nach sich. */
const ChatJsonDialog = later(() => import('./ChatJsonDialog').then((m) => m.ChatJsonDialog), null);

/* -- Eine Rozmowa -------------------------------------------------------------------- */

export function ChatRoom({ me, chatId }: { me: Me; chatId: string }) {
  const endpoint = chatEndpoint(chatId);
  /* 0076 — gemeldet wird über `notify.ts` (die Glocke), nicht noch einmal hier. */
  const extras = useChatExtras(endpoint, { notify: false });
  const areas = useAreas();
  const [chat, setChat] = useState<ChatDetail | null | undefined>(undefined);
  const [keys, setKeys] = useState<ReadonlyMap<number, Uint8Array>>(new Map());

  /* Die Schlüssel der NACHRICHTEN — aus denen des Bereichs abgeleitet (0053). */
  const [talk, setTalk] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  /* 0062 — worauf geantwortet, was bearbeitet, was weitergegeben wird; bis wann gelesen war. */
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const [forward, setForward] = useState<Opened | null>(null);
  const [unreadAfter, setUnreadAfter] = useState<string | null | undefined>(undefined);
  const composer = useRef<ComposerHandle | null>(null);

  /* 0058 — welche Geschichte offen ist, und bis wann Änderungen geholt sind. */
  const [history, setHistory] = useState<{
    load: () => Promise<{ versions: readonly SealedVersion[] }>;
    open: (version: SealedVersion) => Promise<Opened | null>;
  } | null>(null);
  const asOf = useRef<string | null>(null);

  /* Als wen zuletzt — dieselbe Wahl wie auf der Seite (`chat.as.<id>`); sonst die eigene Person. */
  const [picked, setAs] = useRemembered(`chat.as.${chatId}`, '');

  /*
   * 0068 — TEMATY: welche es gibt, welches gewählt ist (Filter und Ziel),
   * und was aus einer Nachricht entsteht (Aufgabe, Termin) oder wohin sie wandert.
   */
  const [topics, setTopics] = useState<readonly Topic[]>([]);
  const [topic, setTopic] = useRemembered(`chat.topic.${chatId}`, '');
  const [linked, setLinked] = useState(false);
  /* 0105 — „Usuń rozmowę": erst fragen. */
  const [removing, setRemoving] = useState(false);
  /* 2026-10-29 — „Rozmowa jako JSON". */
  const [json, setJson] = useState(false);
  const [taskFrom, setTaskFrom] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const [eventFrom, setEventFrom] = useState<{ message: SealedMessage; opened: Opened; calendars: readonly CalendarRow[] } | null>(null);
  /* 0101 — was gerade in ein Thema zusammengetragen wird (eine Nachricht oder die markierten), und was danach gesagt wird. */
  const [collecting, setCollecting] = useState<{ readonly messages: readonly SealedMessage[]; readonly done: () => void } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (note === null) return undefined;
    const timer = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(timer);
  }, [note]);

  /* Der Chat, seine Schlüssel, die Namen darin. */
  const lookChat = useCallback(async (freshKeys = false) => {
    try {
      const found = await loadChat(chatId);
      const held = await areaKeys(me.ring, found.areaId, freshKeys);
      const derived = await chatKeysOf(found.chatId, held);
      setChat(found);
      setKeys(held);
      setTalk(derived);
      setNames(await openNames(held, found.areaId, found.names));
      setUnreadAfter((was) => (was === undefined ? found.readAt : was));

      /* Wer mit Link wartet, bekommt seinen Schlüssel, sobald jemand von hier hereinschaut. */
      const by = keyHolderOf(found, me.ring);
      if (by !== undefined && found.seats.some((one) => one.wrapPublicKey !== null && !one.epochs.includes(found.currentEpoch))) {
        void deliverSeatKeys(found, held, by).catch(() => undefined);
      }
      return { found, held: derived, area: held };
    } catch (e) {
      setChat(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
      return null;
    }
  }, [chatId, me.ring]);

  const open = async (held: ReadonlyMap<number, Uint8Array>, messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(held, message) })));

  /* Das erste Bild: der Chat und die letzten Nachrichten. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const got = await lookChat();
      if (got === null || !alive) return;
      const { messages, asOf: at } = await loadMessages(chatId);
      const opened = await open(got.held, messages);
      if (!alive) return;
      asOf.current = at ?? null;
      setShown(opened);
      reportChatSeen(endpoint, opened[opened.length - 1]?.message.createdAt ?? null);
      setMore(messages.length >= 60);
      void markRead(chatId).catch(() => undefined);

      /*
       * SICH VORSTELLEN — einmal. Wer hier schreibt und in diesem Bereich noch
       * keinen Namen trägt, bekommt den eigenen: sonst sähen die anderen an
       * seinen Nachrichten nur eine Kennung.
       */
      /*
       * 0095 — und WER DURCH EINE ROLLE spricht, stellt sich als Person vor:
       * „Anna Nowak (Rada)" — ihr Name unter dem Schlüssel des Bereichs (die
       * Namen liegen unter ihm, nicht unter dem der Rozmowa).
       */
      const introduce = new Set([...got.found.writers, ...speakersOf(got.found.writers, me.graph, (id) => me.ring.maySign(id)).map((one) => one.personId)]);
      for (const roleId of introduce) {
        if (got.found.names.some((n) => n.roleId === roleId)) continue;
        const mine = me.names.get(roleId);
        if (mine !== undefined) void setMemberName(got.found.areaId, got.area, roleId, mine, roleId).catch(() => undefined);
      }
    })();
    return () => { alive = false; };
  }, [chatId, lookChat, me.names, me.graph, me.ring]);

  /*
   * 0059 — WAS SICH AN SCHON GEZEIGTEN NACHRICHTEN GEÄNDERT HAT: bearbeitet,
   * gelöscht, zurückgeholt. Sie werden an ihrer Stelle ersetzt.
   */
  const pullChanged = useCallback(async (held: ReadonlyMap<number, Uint8Array>) => {
    if (asOf.current === null) return;
    const { messages, asOf: at } = await loadMessages(chatId, { changed: asOf.current });
    if (at !== undefined) asOf.current = at;
    if (messages.length === 0) return;
    const opened = await open(held, messages);
    setShown((was) => (was ?? []).map((w) => opened.find((o) => o.message.messageId === w.message.messageId) ?? w));
  }, [chatId]);

  /* NACHLADEN — alle paar Sekunden, solange die Karte sichtbar ist. */
  const list = shown ?? [];
  const last = list.length === 0 ? null : list[list.length - 1].message.createdAt;
  const lastId = list.length > 0 ? list[list.length - 1].message.messageId : undefined;
  useEffect(() => {
    if (chat == null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadMessages(chatId, last === null ? {} : { after: last, afterId: lastId });
          let held = talk;
          if (messages.some((m) => !held.has(m.epoch))) held = (await lookChat(true))?.held ?? held;
          if (messages.length > 0) {
            const opened = await open(held, messages);
            setShown((was) => [...(was ?? []), ...opened.filter((o) => !(was ?? []).some((w) => w.message.messageId === o.message.messageId))]);
            void markRead(chatId).catch(() => undefined);
          }
          reportChatSeen(endpoint, messages[messages.length - 1]?.createdAt ?? last);
          await pullChanged(held);
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [chat, chatId, last, lastId, talk, lookChat, pullChanged]);

  /* 0068 — die Themen: beim Öffnen, nach jeder Änderung, und alle 30 s (sie ändern sich selten). */
  const lookTopics = useCallback(async () => {
    if (talk.size === 0) return;
    try {
      const { topics: rows } = await loadTopics(endpoint);
      setTopics(await openTopics(talk, rows));
    } catch {
      // Ohne Themen bleibt die Rozmowa, wie sie war.
    }
  }, [endpoint, talk]);
  useEffect(() => {
    void lookTopics();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void lookTopics(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [lookTopics]);

  const earlier = useCallback(async () => {
    const first = shown?.[0];
    if (first === undefined) return;
    const { messages } = await loadMessages(chatId, { before: first.message.createdAt, beforeId: first.message.messageId });
    const opened = await open(talk, messages);
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  }, [chatId, shown, talk]);

  const moderates = chat != null && chat.certifiers.length > 0 && chat.kind !== 'direct';
  /* 0080 — in der Rozmowa des Bereichs und im Kanał sagt die Art, wer schreibt: dort gibt es keine Zasada zum Umstellen. */
  const chrome = useChatChrome({ endpoint, extras, keys: talk, canModerate: moderates && chat != null && !fixedPolicy(chat.kind), onPolicy: () => void lookChat() });

  /*
   * 0095 — WER SPRICHT: eine Rolle, die hier schreibt, und eine eigene Person,
   * die sie hält. Die Wahl merkt sich die Rozmowa (`rola|osoba`).
   */
  const speakers = useMemo(() => (chat == null ? [] : speakersOf(chat.writers, me.graph, (id) => me.ring.maySign(id))),
    [chat, me.graph, me.ring]);
  const speaker = chooseSpeaker(speakers, picked);
  const as = speaker?.roleId ?? '';
  /* Schreiben dürfte eine Rolle, aber keine eigene Person hält sie — dann fehlt die Person. */
  const noPerson = chat != null && speakers.length === 0 && chat.writers.some((id) => me.ring.maySign(id));
  /* 2026-10-29 — eine eigene Person schreibt hier (ein Kanał kann es trotzdem verbieten) — für den Import als JSON. */
  const writes = speaker !== null && extras.features?.canWrite !== false;

  if (chat === undefined) return <p className="ch-empty">Wczytywanie…</p>;
  if (chat === null) {
    return (
      <div className="ch-page">
        <p><a className="wk-link" href={viewPath('chat')}>← Rozmowy</a></p>
        <p className="wk-error">{failed ?? 'Takiej rozmowy nie ma.'}</p>
      </div>
    );
  }

  const self = chat.kind === 'self';
  const other = chat.kind === 'direct' ? chat.members.find((m) => !me.ring.has(m.roleId)) : undefined;
  const seatChat = chat.kind === 'seat';
  const title = self ? 'Notatki'
    : seatChat ? `Rozmowa z: ${chat.seats[0]?.name ?? 'osobą z formularza'}`
    : other !== undefined ? nameOf(other.roleId, other.kind, names, me.names)
    : chat.kind === 'channel' ? `Kanał: ${titleOfArea(areas, chat.areaId, chat.areaName)}`
    : titleOfArea(areas, chat.areaId, chat.areaName);

  /* 0068 — das gewählte Thema, wenn es das noch gibt. */
  const currentTopic = topic !== '' && topics.some((t) => t.topicId === topic) ? topic : null;
  const person = me.roles.find((r) => r.kind === 'person') ?? null;
  const asPerson: Person | null = person === null ? null : { ring: me.ring, roles: me.roles, person, names: me.names };
  const kindOf = (roleId: string) => chat.members.find((m) => m.roleId === roleId)?.kind;
  const known = (id: string) => names.get(id) ?? me.names.get(id) ?? null;
  /* 0095 — meine: die Rolle UND die Person, die durch sie sprach. */
  const mine = (message: SealedMessage) => isMine(message, (id) => me.ring.has(id));
  const persons = new Set(speakers.map((one) => one.personId));

  /*
   * WER SCHREIBT. Eine Rolle heisst, wie der Bereich sie nennt — sonst wie sie
   * sich in der Nachricht selbst nennt. Ein Platz heisst, wie er sich nennt,
   * sonst wie die Kanzlei ihn am Platz führt. Die eigenen: „Ty" — mit Namen,
   * wenn ich hier als mehr als eine Rolle schreibe.
   */
  const authorOfMessage = (message: SealedMessage, opened: Opened | null) => messageAuthor(message, opened, {
    name: (id) => names.get(id) ?? me.names.get(id) ?? (message.authorPersonId == null && id === message.authorRoleId && opened?.name == null ? nameOf(id, kindOf(id), names, me.names) : null),
    seat: (seatId) => chat.seats.find((one) => one.seatId === seatId)
  });
  const authorName = (message: SealedMessage, opened: Opened | null) => {
    const author = authorOfMessage(message, opened);
    /*
     * Die eigenen: „Ty" — mit der Rolle, wenn durch sie geschrieben; mit dem
     * Namen, wenn hier mehr als eine eigene Person spricht (die eines Kindes).
     */
    if (mine(message)) return persons.size > 1 ? `${authorText(author)} · Ty` : author.via === null ? 'Ty' : `Ty (${author.via})`;
    return authorText(author);
  };

  const rules: MessageRules = {
    mine,
    author: authorName,
    note: (message) => (message.authorSeatId !== null ? 'z linku' : null),
    /* 0058 — bearbeiten nur die eigene; zurückholen der Verfasser (wenn er selbst löschte) oder wer moderiert. */
    canEdit: (message, opened) => mine(message) && message.deletedAt === null && opened !== null && chat.writers.includes(message.authorRoleId ?? ''),
    canDelete: (message) => message.deletedAt === null && (mine(message) || moderates),
    canRestore: (message) => message.deletedAt !== null && ((mine(message) && message.deletedBy === 'author') || moderates),
    canPin: moderates,
    group: chat.kind === 'group' || chat.kind === 'area' || chat.kind === 'channel',
    receipts: !self
  };

  /* In Themen ordnen kann, wer eins anlegen darf — oder wo es schon welche gibt. */
  const fileable = (speakers.length > 0 && !self) || topics.length > 0;

  const on: MessageHandlers = {
    reply: (message, opened, author) => { setEditing(null); setReply({ id: message.messageId, text: opened.text, author }); },
    edit: (message, opened) => { setReply(null); setEditing({ message, opened }); },
    remove: async (message) => {
      await deleteMessage(message.messageId);
      setShown((was) => withDelete(was ?? [], message.messageId, mine(message) ? 'author' : 'moderator'));
    },
    restore: async (message) => { await restoreMessage(message.messageId); await pullChanged(talk); },
    history: (message) => setHistory({
      load: () => loadVersions(message.messageId),
      open: (version) => openVersion(talk, message.messageId, authorOf(message), version)
    }),
    forward: (opened) => setForward(opened),

    /* 0066/0070 — aus einer Nachricht: eine Aufgabe, ein Termin. 0068 — in ein Thema. */
    task: asPerson === null ? undefined : (message, opened) => setTaskFrom({ message, opened }),
    appointment: asPerson === null ? undefined : (message, opened) => {
      void loadCalendars().then(({ calendars }) => setEventFrom({ message, opened, calendars })).catch(() => undefined);
    },
    moveTopic: !fileable ? undefined : (message) => setCollecting({ messages: [message], done: () => undefined }),

    /* 0101 — die markierten zusammen in ein Thema. */
    collect: !fileable ? undefined : (messages, done) => setCollecting({ messages, done })
  };

  const send = async (body: string, options: SendOptions) => {
    if (speaker === null) throw new WorkspaceError(noPerson ? 'Do rozmowy potrzebna jest osoba — załóż ją w Koncie.' : 'W tej rozmowie tylko czytasz.');
    /*
     * Die Person und, wenn durch eine Rolle, die Rolle reisen in der Nachricht
     * mit — für die, die die Namen des Bereichs nicht lesen (0053, 0095).
     */
    const name = known(speaker.personId);
    const via = throughRole(speaker) ? known(speaker.roleId) : null;
    const done = await sendMessage(me.ring, chat.chatId, talk, speaker.roleId, body, name,
      { ...options, topicId: currentTopic, personId: speaker.personId, via });
    if (options.sendAt === undefined && options.whenOnline !== true) {
      setShown((was) => [...(was ?? []), {
        message: { messageId: done.messageId, authorRoleId: speaker.roleId, authorPersonId: speaker.personId, authorSeatId: null, epoch: done.epoch, bodySealed: '', createdAt: done.createdAt, deletedAt: null, topicId: currentTopic },
        opened: { text: body, name, ...options, via }
      }]);
    }
  };

  const saveEdit = async (text: string) => {
    if (editing === null) return;
    const { message, opened } = editing;
    const done = await editMessage(me.ring, message.messageId, talk, message.authorRoleId!, text, opened.name, (message.version ?? 1) + 1, opened);
    setShown((was) => withEdit(was ?? [], message.messageId, done, text));
    setEditing(null);
  };

  /* Unter dem Namen: wer gerade schreibt, sonst wer dabei ist. */
  const n = chat.members.length;
  const theirs = other === undefined ? undefined : extras.features?.receipts.find((r) => r.roleIds.includes(other.roleId))?.available;
  const subtitle = chrome.status.typing ? <span className="ch-typing">{chat.kind === 'direct' ? 'pisze…' : 'ktoś pisze…'}</span>
    : self ? 'tylko Ty · szyfrowane w przeglądarce'
    /* 0111 — „online" / „ostatnio w aplikacji" geht vor den Godziny dostępności (wenn der andere es teilt). */
    : chat.kind === 'direct' ? (chrome.presence ?? (theirs === true ? 'w godzinach dostępności' : theirs === false ? 'poza godzinami dostępności' : 'rozmowa we dwoje'))
    : [
      `${n} ${plural(n, 'uczestnik', 'uczestnicy', 'uczestników')}`,
      chat.seats.length > 0 ? `${chat.seats.length} z linkiem` : null,
      chrome.status.channel ? 'kanał' : null,
      chrome.status.available + chrome.status.away > 0 ? `dostępnych: ${chrome.status.available}` : null,
      chrome.presence
    ].filter(Boolean).join(' · ');

  const menu: MenuItem[] = [
    ...chrome.items,
    { label: 'Zadania i terminy z rozmowy', icon: 'check' as const, onSelect: () => setLinked(true) },
    /* 2026-10-29 — die Rozmowa als JSON: Export für jeden Leser; Import (`chatJson.ts`) für wer schreibt oder moderiert. */
    { label: 'Rozmowa jako JSON', icon: 'braces' as const, onSelect: () => setJson(true) },
    ...(self ? [] : [{ label: `Uczestnicy i ustawienia`, icon: 'users' as const, onSelect: () => setSettings(true) }]),
    { label: self ? 'Mój prywatny obszar' : 'Obszar tej rozmowy', icon: 'area', onSelect: () => { window.location.hash = viewPath('areas', chat.areaId); } },
    /* 0105 — wer den Bereich führt (zu zweit: jeder der beiden) löscht die Rozmowa für alle. */
    ...(moderates || (chat.kind === 'direct' && chat.writers.length > 0)
      ? [{ label: 'Usuń rozmowę', icon: 'trash' as const, danger: true, onSelect: () => setRemoving(true) }]
      : [])
  ];

  const readOnly = noPerson ? 'Do rozmowy potrzebna jest osoba (imię i nazwisko) — załóż ją w Koncie, w zakładce „Role".'
    : speakers.length === 0 ? (chat.kind === 'channel' ? 'W tym kanale piszą ci, którzy mają w obszarze prawo zapisu — Ty czytasz.' : 'W tej rozmowie tylko czytasz.')
    : extras.features?.canWrite === false ? 'Ten kanał pozwala Ci tylko czytać.'
    : null;

  return (
    <div className="ch-room">
      <ChatHeader
        back={viewPath('chat')}
        title={title}
        avatar={<Avatar seed={self ? 'self' : other?.roleId ?? chat.chatId} name={title} icon={self ? 'bookmark' : undefined} />}
        subtitle={subtitle}
        menu={menu}
        search={extras.search}
        onSearch={extras.setSearch}
        quiet={chrome.status.quiet}
      />
      {chrome.banner}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}
      {note !== null && <p className="ch-bar" role="status" data-chat-note="">{note}</p>}

      {/* 0068 — Tematy: Filter und Ziel des Schreibens. */}
      <TopicBar
        topics={topics}
        current={currentTopic}
        canCreate={speakers.length > 0 && !self}
        canManage={moderates || speakers.length > 0}
        onPick={(id) => setTopic(id ?? '')}
        onCreate={async (name) => { const id = await createTopic(endpoint, talk, name, as === '' ? null : as); await lookTopics(); setTopic(id); }}
        onChanged={() => void lookTopics()}
      />

      <ChatLog
        endpoint={endpoint}
        items={currentTopic === null || shown === undefined ? shown : shown.filter((one) => one.message.topicId === currentTopic)}
        features={extras.features}
        matches={extras.matches}
        rules={rules}
        on={on}
        more={more}
        onEarlier={earlier}
        empty={self ? 'Zapisuj tu myśli, linki i pliki dla siebie — nikt inny ich nie zobaczy.' : 'Jeszcze nikt nic nie napisał — możesz zacząć.'}
        onFiles={(files) => composer.current?.addFiles(files)}
        unreadAfter={unreadAfter ?? null}
        search={extras.search}
        filter={extras.filter}
      />

      <Composer
        ref={composer}
        endpoint={endpoint}
        onlineSend={chrome.onlineSend}
        readOnly={readOnly}
        placeholder={speaker !== null && speakers.length > 1 ? `Wiadomość jako ${speakerText(speaker, known)}` : self ? 'Notatka' : 'Wiadomość'}
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
        before={chrome.chip}
        sendAs={speaker !== null && speakers.length > 1 ? <SpeakerPick speakers={speakers} speaker={speaker} name={known} onPick={(one) => setAs(speakerKey(one))} /> : null}
      />

      {chrome.dialogs}
      {settings && (
        <Modal title={`Uczestnicy (${chat.members.length}${chat.seats.length > 0 ? ` + ${chat.seats.length} z linkiem` : ''}) i ustawienia`} wide onClose={() => setSettings(false)}>
          <ChatSettings me={me} chat={chat} names={names} keys={keys} onChanged={() => void lookChat(true)} />
        </Modal>
      )}
      {forward !== null && <ForwardDialog endpoint={endpoint} opened={forward} ring={me.ring} onClose={() => setForward(null)} />}

      {linked && <LinkedDialog ring={me.ring} chatId={chat.chatId} topics={topics} onClose={() => setLinked(false)} />}
      {json && (
        <ChatJsonDialog
          chat={chat}
          title={title}
          ring={me.ring}
          talk={talk}
          topics={topics}
          features={extras.features}
          scheduled={chrome.scheduled.list}
          speaker={speaker}
          speakerName={speaker === null ? null : speakerText(speaker, known)}
          personName={speaker === null ? null : known(speaker.personId)}
          via={speaker !== null && throughRole(speaker) ? known(speaker.roleId) : null}
          writes={writes}
          moderates={moderates}
          author={(message, opened) => authorText(authorOfMessage(message, opened))}
          mine={mine}
          mayFile={(message) => moderates || mine(message) || ((chat.kind === 'direct' || self) && writes)}
          topicBy={(t) => (t.createdByRoleId !== null ? known(t.createdByRoleId)
            : t.createdBySeatId !== null ? chat.seats.find((one) => one.seatId === t.createdBySeatId)?.name ?? 'osoba z linkiem' : null)}
          topicMayChange={(t) => moderates || (t.createdByRoleId !== null ? me.ring.has(t.createdByRoleId) : writes)}
          onImported={(moved) => {
            if (moved.size > 0) {
              setShown((was) => (was ?? []).map((w) => (moved.has(w.message.messageId) ? { ...w, message: { ...w.message, topicId: moved.get(w.message.messageId) ?? null } } : w)));
            }
            void lookTopics();
            void extras.refresh().catch(() => undefined);
            chrome.scheduled.refresh();
          }}
          onClose={() => setJson(false)}
        />
      )}
      {removing && <RemoveChat chatId={chat.chatId} title={title} kind={chat.kind} seats={chat.seats.length} onClose={() => setRemoving(false)} />}
      {collecting !== null && (
        <CollectToTopic count={collecting.messages.length} topics={topics} canCreate={speakers.length > 0 && !self}
          onClose={() => setCollecting(null)}
          onCollect={async (target) => {
            const topicId = 'title' in target ? await createTopic(endpoint, talk, target.title, as === '' ? null : as) : target.topicId;
            const done = await collectToTopic(chat.chatId, collecting.messages.map((m) => m.messageId), topicId);
            const moved = new Set(done.moved);
            setShown((was) => (was ?? []).map((w) => (moved.has(w.message.messageId) ? { ...w, message: { ...w.message, topicId } } : w)));
            await lookTopics();
            const name = topicId === null ? null : 'title' in target ? target.title : topics.find((t) => t.topicId === topicId)?.title ?? 'temat';
            collecting.done();
            setCollecting(null);
            setNote(`${moved.size === 1 ? 'Przeniesiono 1 wiadomość' : `Przeniesiono ${moved.size} wiadomości`}${name === null ? ' poza tematy' : ` do „${name}"`}.`
              + (done.notYours > 0 ? ` ${done.notYours} cudzych przenosi prowadzący.` : ''));
          }} />
      )}
      {taskFrom !== null && asPerson !== null && (
        <TaskDialog me={asPerson} areas={areas} task={null}
          initialTitle={titleFrom(taskFrom.opened.text)}
          initialArea={areas.some((a) => a.areaId === chat.areaId && (a.myLevel === 'write' || a.myLevel === 'admin')) ? chat.areaId : undefined}
          origin={{ chatId: chat.chatId, topicId: taskFrom.message.topicId ?? currentTopic, messageId: taskFrom.message.messageId }}
          onClose={() => setTaskFrom(null)} onSaved={() => void lookTopics()} />
      )}
      {eventFrom !== null && asPerson !== null && (
        <EventDialog me={asPerson} areas={areas} calendars={eventFrom.calendars}
          target={{
            at: 'new', allDay: false,
            start: new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 86_400_000),
            end: new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 86_400_000 + 3_600_000),
            calendarId: eventFrom.calendars.find((c) => c.areaId === chat.areaId && c.mayWrite === true)?.calendarId,
            title: titleFrom(eventFrom.opened.text),
            origin: { chatId: chat.chatId, topicId: eventFrom.message.topicId ?? currentTopic }
          }}
          onClose={() => setEventFrom(null)} onSaved={() => void lookTopics()} />
      )}
      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
    </div>
  );
}

/**
 * 0105 — „USUŃ ROZMOWĘ": was geht und was bleibt, in Worten — und erst auf
 * einen zweiten, ausdrücklichen Klick. Danach steht die Liste da.
 */
function RemoveChat({ chatId, title, kind, seats, onClose }: {
  chatId: string;
  title: string;
  kind: ChatDetail['kind'];
  seats: number;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await removeChat(chatId);
      window.dispatchEvent(new Event(CHATS_CHANGED));
      onClose();
      window.location.hash = viewPath('chat');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć rozmowy.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Usunąć rozmowę?" onClose={onClose}>
      <div className="wk-form" data-remove-chat="">
        <p>
          <strong>{title}</strong> zniknie dla wszystkich{kind === 'direct' ? ' — także dla drugiej osoby' : ''}
          {seats > 0 ? ` — także dla osób z linkiem (${seats})` : ''}: wszystkie wiadomości, pliki i tematy.
          Tego nie da się cofnąć.
        </p>
        <p className="wk-hint">
          {kind === 'self'
            ? 'Zostaje Twój prywatny obszar. Zadania i terminy utworzone z notatek zostają — bez odnośnika do nich.'
            : 'Zostaje obszar rozmowy i jego uczestnicy — można w nim później zacząć nową rozmowę. Zadania i terminy utworzone z wiadomości zostają, bez odnośnika do rozmowy.'}
        </p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          {/* Der Fokus steht zuerst auf „Anuluj" — Enter löscht nichts aus Versehen. */}
          <button type="button" className="wk-link-btn" disabled={busy} onClick={onClose}>Anuluj</button>
          <button type="button" className="wk-btn wk-btn-danger" disabled={busy} data-remove-chat-confirm="" onClick={() => void remove()}>
            {busy ? 'Usuwanie…' : 'Usuń rozmowę'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
