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
  ChatHeader, ChatLog, Composer, lastEditable, plural, useChatChrome, withDelete, withEdit,
  type ComposerHandle, type MessageHandlers, type MessageRules, type ReplyTarget, type Shown
} from './ChatKit';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  areaKeys, authorOf, chatKeysOf, deleteMessage, deliverSeatKeys, editMessage, keyHolderOf, loadChat, loadMessages, loadVersions,
  markRead, openMessage, openNames, openVersion, restoreMessage, sendMessage, setMemberName, fixedPolicy,
  type ChatDetail, type Opened, type SealedMessage, type SealedVersion, type SendOptions
} from './chat';
import {
  authorText, chooseSpeaker, isMine, messageAuthor, speakerKey, speakersOf, speakerText, throughRole, type GraphLike
} from './chatAuthor';
import { keysFor } from './ringOf';
import { SpeakerPick } from './SpeakerPick';
import type { Ring } from './keys';
import { HistoryDialog } from './MessageBits';
import { usePerson, type PagePerson } from './pagePerson';
import { useRemembered } from './prefs';
import { myRoleNames } from './roleNames';
import { LinkChatRoom, VisitorChat } from './LinkChatJoin';
import { loadLinkChat } from './linkPerson';
import { heldLinks } from './linkKeep';
import { parsePath } from './routes';
import { whoIsThere, WorkspaceError } from './session';
import { Loading } from './ui/Loading';

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
export function PageChatCard({ title, chatId, path = null }: { title: string; chatId: string; path?: string | null }) {
  const person = usePerson();
  const head = <h2 className="wk-card-title">{title.trim() === '' ? 'Rozmowa' : title}</h2>;

  if (chatId === '') {
    return <>{head}<p className="wk-card-muted">Tu pojawi się rozmowa grupy — trzeba ją jeszcze wybrać.</p></>;
  }

  const chosen = person?.chosen ?? null;

  /*
   * 0095 — DER MENSCH MIT DEM LINK: seine Rozmowa hängt an seinem Platz. Die
   * oben gewählte Person zuerst, dann jede andere dieses Browsers, die in die
   * Rozmowa kommt (die aus dem Formular); sonst, wenn ein Link mit Zugang sie
   * öffnet, stellt er sich vor (Imię, Nazwisko) und wird eine Person des Links.
   */
  const seats = (person?.options ?? []).flatMap((one) => (one.kind === 'seat' ? [one.seat] : []));
  /* Die Seite, auf der man sich vorstellt — dort findet die Seite die neue Person wieder. */
  const here = path ?? parsePath(window.location.hash).page ?? null;
  const fallback = (
    <p className="wk-card-muted">
      {person?.loading === true
        ? 'Wczytywanie…'
        : 'Ta rozmowa należy do grupy. Zaloguj się albo otwórz swój osobisty link — wtedy pojawi się tutaj.'}
    </p>
  );

  if (chosen?.kind === 'seat') {
    return <>{head}<VisitorChat chatId={chatId} seats={seats} chosen={chosen.seat} under={here} fallback={fallback} /></>;
  }

  const role: RolePerson | null = chosen?.kind === 'role'
    ? chosen
    : person?.options.find((one): one is RolePerson => one.kind === 'role') ?? null;

  if (role === null) {
    if (person?.loading !== true && (seats.length > 0 || heldLinks().length > 0)) {
      return <>{head}<VisitorChat chatId={chatId} seats={seats} chosen={null} under={here} fallback={fallback} /></>;
    }
    return <>{head}{fallback}</>;
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

  /* 0095 — wer welche Rolle hält: daraus, welche eigene Person durch welche Rolle spricht. */
  const [graph, setGraph] = useState<GraphLike | null>(null);
  const [areaHeld, setAreaHeld] = useState<ReadonlyMap<number, Uint8Array>>(new Map());

  useEffect(() => {
    let alive = true;
    void (async () => {
      const who = await whoIsThere();
      if (who === null) return;
      const [names, keys] = await Promise.all([myRoleNames(who), keysFor(who)]);
      if (!alive) return;
      setOwn(names);
      const roles = keys.graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id));
      setGraph({ roles, edges: keys.graph.edges });
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [ring]);

  const persons = new Map((person?.options ?? [])
    .filter((one): one is RolePerson => one.kind === 'role')
    .map((one) => [one.id, one.name] as const));

  /* Wie mich die Gruppe sieht: der Name, den sie von mir kennt; sonst der meiner Person oder Rolle. */
  const nameOf = (id: string): string | null => names.get(id) ?? persons.get(id) ?? own.get(id) ?? null;

  /*
   * 0095 — WER SPRICHT: eine Rolle, die hier schreibt, und eine eigene Person,
   * die sie hält — wer als er selbst schreiben kann, steht vorn. Ohne eigene
   * Wahl die oben auf der Seite gewählte Person.
   */
  const speakers = chat == null || graph === null ? [] : speakersOf(chat.writers, graph, (id) => ring.maySign(id));
  const speaker = chooseSpeaker(speakers, picked, asRoleId);
  const noPerson = chat != null && graph !== null && speakers.length === 0 && chat.writers.some((id) => ring.maySign(id));

  /* SICH VORSTELLEN — wer durch eine Rolle spricht, mit seinem Namen unter dem Schlüssel des Bereichs. */
  const introduced = useRef(new Set<string>());
  useEffect(() => {
    if (chat == null || areaHeld.size === 0) return;
    for (const one of speakers) {
      const id = one.personId;
      if (introduced.current.has(id) || chat.names.some((n) => n.roleId === id)) continue;
      const mine = own.get(id) ?? persons.get(id);
      if (mine === undefined) continue;
      introduced.current.add(id);
      void setMemberName(chat.areaId, areaHeld, id, mine, id).catch(() => undefined);
    }
  });

  const look = useCallback(async (fresh = false) => {
    try {
      const found = await loadChat(chatId);
      const held = await areaKeys(ring, found.areaId, fresh);
      const derived = await chatKeysOf(found.chatId, held);
      setChat(found);
      setAreaHeld(held);
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

  if (chat === undefined) return <Loading label="Wczytywanie rozmowy…" />;
  if (chat === null) {
    /* 0095 — das Konto liest hier nicht; ein Link in diesem Browser vielleicht doch (Lesen zählt zusammen). */
    return <ReadThroughLink chatId={chatId} fallback={<p className="wk-card-muted">{failed ?? 'Ta rozmowa nie jest dla Ciebie — albo już jej nie ma.'}</p>} />;
  }

  /* 0095 — meine: die Rolle UND die Person, die durch sie sprach. */
  const mine = (message: SealedMessage) => isMine(message, (id) => ring.has(id));
  const persons2 = new Set(speakers.map((one) => one.personId));

  const authorName = (message: SealedMessage, opened: Opened | null): string => {
    const author = messageAuthor(message, opened, {
      name: (id) => nameOf(id),
      seat: (seatId) => chat?.seats.find((one) => one.seatId === seatId)
    });
    /* Meine eigenen: „Ty" — mit der Rolle, wenn durch sie; mit dem Namen, wenn hier mehr als eine eigene Person spricht. */
    if (mine(message)) return persons2.size > 1 ? `${authorText(author)} · Ty` : author.via === null ? 'Ty' : `Ty (${author.via})`;
    return message.authorRoleId !== null && message.authorPersonId == null && names.get(message.authorRoleId) === undefined && opened?.name == null
      ? 'ktoś z grupy' : authorText(author);
  };

  const rules: MessageRules = {
    mine,
    author: authorName,
    note: (message) => (message.authorSeatId !== null ? 'z linku' : null),
    canEdit: (message, opened) => mine(message) && message.deletedAt === null && opened !== null && speakers.some((one) => one.roleId === message.authorRoleId),
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
    if (speaker === null) throw new WorkspaceError(noPerson ? 'Do rozmowy potrzebna jest osoba — załóż ją w Koncie.' : 'W tej rozmowie tylko czytasz.');
    /* Die Person und, wenn durch eine Rolle, die Rolle reisen in der Nachricht mit (0053, 0095). */
    const name = nameOf(speaker.personId);
    const via = throughRole(speaker) ? nameOf(speaker.roleId) : null;
    const done = await sendMessage(ring, chatId, talk, speaker.roleId, body, name, { ...options, personId: speaker.personId, via });
    if (options.sendAt === undefined && options.whenOnline !== true) {
      setShown((was) => [...(was ?? []), {
        message: { messageId: done.messageId, authorRoleId: speaker.roleId, authorPersonId: speaker.personId, authorSeatId: null, epoch: done.epoch, bodySealed: '', createdAt: done.createdAt, deletedAt: null },
        opened: { text: body, name, ...options, via }
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
    chrome.status.channel ? 'kanał' : null,
    chrome.presence
  ].filter(Boolean).join(' · ');

  /* Die oben gewählte Person, wenn SIE hier nicht schreiben darf — damit niemand glaubt, er schreibe als sie. */
  const asked = speaker !== null && speaker.personId !== asRoleId && !speakers.some((one) => one.personId === asRoleId) && persons.has(asRoleId)
    ? persons.get(asRoleId)! : null;

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
        onlineSend={chrome.onlineSend}
        readOnly={noPerson ? 'Do rozmowy potrzebna jest osoba (imię i nazwisko) — załóż ją w Koncie.'
          : speaker === null ? 'W tej rozmowie tylko czytasz.' : extras.features?.canWrite === false ? 'Ten kanał pozwala Ci tylko czytać.' : null}
        placeholder={speaker !== null && speakers.length > 1 ? `Wiadomość jako ${speakerText(speaker, nameOf)}` : 'Wiadomość'}
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
          {asked !== null && <p className="ch-note">{asked} nie pisze w tej grupie — piszesz jako <strong>{speakerText(speaker!, nameOf)}</strong>.</p>}
          {chrome.chip}
        </>}
        sendAs={speaker !== null && speakers.length > 1 ? <SpeakerPick speakers={speakers} speaker={speaker} name={nameOf} onPick={(one) => pick(speakerKey(one))} /> : null}
      />

      {chrome.dialogs}
      {forward !== null && <ForwardDialog endpoint={endpoint} opened={forward} ring={ring} onClose={() => setForward(null)} />}
      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}
    </div>
  );
}

/**
 * 0095 — LESEN ÜBER EINEN LINK, AUCH ANGEMELDET: hält dieser Browser einen
 * Link, der die Rozmowa liest, das Konto aber nicht, steht sie zum Lesen da —
 * wie jede Seite, die der Link öffnet. Schreiben geht über das Konto (den Link
 * dort aufnehmen).
 */
function ReadThroughLink({ chatId, fallback }: { chatId: string; fallback: React.ReactNode }) {
  const [readable, setReadable] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadLinkChat(chatId).then((found) => { if (alive) setReadable(found !== null); });
    return () => { alive = false; };
  }, [chatId]);
  if (readable === undefined) return <Loading label="Wczytywanie rozmowy…" />;
  return readable ? <LinkChatRoom chatId={chatId} under={null} onJoined={() => undefined} signedIn /> : <>{fallback}</>;
}

export default PageChatCard;
