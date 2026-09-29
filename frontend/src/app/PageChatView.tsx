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

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  areaKeys, authorOf, chatKeysOf, deleteMessage, deliverSeatKeys, loadChat, loadMessages, markRead, openMessage,
  openNames, sendMessage, type ChatDetail, type Opened, type SealedMessage
} from './chat';
import type { Ring } from './keys';
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

export function PageChatRoom({ chatId, ring, asRoleId }: { chatId: string; ring: Ring; asRoleId: string }) {
  const [chat, setChat] = useState<ChatDetail | null | undefined>(undefined);
  const [talk, setTalk] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[]>([]);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const log = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  /*
     WER HIER SCHREIBT — und das steht über dem Feld, samt Wahl, wenn es mehr
     als eine gibt. Bisher wählte die Seite still: die oben gewählte Person,
     sonst irgendeine eigene Rolle, die schreiben darf. Wer dann als „Rada"
     statt als er selbst schrieb, erfuhr es erst aus der Antwort — und im
     Vollbild sieht man die Wahl oben gar nicht.

     Wer schreiben darf, sagt der Dienst (`writers`); wofür ich unterschreiben
     kann, der Schlüsselbund. Eine Wahl HIER merkt sich die Rozmowa —
     versiegelt, je Rozmowa, im Arbeitsplatz und auf der Seite dieselbe
     (`chat.as.<id>`); ohne sie gilt die oben gewählte Person.
  */
  const person = usePerson();
  const [picked, pick] = useRemembered(`chat.as.${chatId}`, '');
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

      /* Wer mit Link wartet, bekommt seinen Schlüssel, sobald ein Mitglied hereinschaut. */
      const by = found.writers[0];
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
      const { messages } = await loadMessages(chatId);
      const opened = await open(keys, messages);
      if (!alive) return;
      setShown(opened);
      setMore(messages.length >= 60);
      void markRead(chatId).catch(() => undefined);
    })();
    return () => { alive = false; };
  }, [chatId, look, open]);

  /* Nachladen, solange die Seite sichtbar ist. Eine unbekannte Epoche holt neue Schlüssel. */
  const last = shown.length === 0 ? null : shown[shown.length - 1].message.createdAt;
  const ready = chat != null;
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadMessages(chatId, last === null ? {} : { after: last });
          if (messages.length === 0) return;
          const keys = messages.some((m) => !talk.has(m.epoch)) ? (await look(true)) ?? talk : talk;
          const opened = await open(keys, messages);
          setShown((was) => [...was, ...opened.filter((o) => !was.some((w) => w.message.messageId === o.message.messageId))]);
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [ready, chatId, last, talk, look, open]);

  useEffect(() => {
    const el = log.current;
    if (el !== null && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  if (chat === undefined) return <p className="wk-card-muted">Wczytywanie rozmowy…</p>;
  if (chat === null) {
    return <p className="wk-card-muted">{failed ?? 'Ta rozmowa nie jest dla Ciebie — albo już jej nie ma.'}</p>;
  }

  const earlier = async () => {
    const first = shown[0]?.message.createdAt;
    if (first === undefined) return;
    const { messages } = await loadMessages(chatId, { before: first });
    const opened = await open(talk, messages);
    stick.current = false;
    setShown((was) => [...opened, ...was]);
    setMore(messages.length >= 60);
  };

  const send = async () => {
    const body = text.trim();
    if (body === '' || busy || speaker === null) return;
    setBusy(true);
    setFailed(null);
    try {
      /* Der Name reist in der Nachricht mit — für die, die die Namen des Bereichs nicht lesen (0053). */
      const name = nameOf(speaker);
      const done = await sendMessage(ring, chatId, talk, speaker, body, name);
      stick.current = true;
      setShown((was) => [...was, {
        message: {
          messageId: done.messageId, authorRoleId: speaker, authorSeatId: null, epoch: done.epoch,
          bodySealed: '', createdAt: done.createdAt, deletedAt: null
        },
        opened: { text: body, name }
      }]);
      setText('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };

  const authorName = (message: SealedMessage, opened: Opened | null): string => {
    const id = message.authorRoleId;
    if (id === null) return opened?.name ?? 'osoba z linkiem';

    /* Meine eigenen: mit dem Namen, unter dem sie hinausgingen — ich schreibe vielleicht als mehr als eine Rolle. */
    if (ring.has(id)) {
      const as = nameOf(id) ?? opened?.name ?? null;
      return as === null ? 'Ty' : `${as} (Ty)`;
    }

    return names.get(id) ?? opened?.name ?? 'ktoś z grupy';
  };

  return (
    <div className="wk-chat-room wk-page-chat-room">
      <div
        className="wk-chat-log"
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {more && shown.length > 0 && (
          <button type="button" className="wk-link-btn wk-chat-earlier" onClick={() => void earlier()}>
            Wczytaj wcześniejsze
          </button>
        )}
        {shown.length === 0 && <p className="wk-empty">Jeszcze nikt nic nie napisał — możesz zacząć.</p>}

        {shown.map(({ message, opened }, i) => {
          const mine = message.authorRoleId !== null && ring.has(message.authorRoleId);
          const prev = shown[i - 1]?.message;
          const same = prev !== undefined && authorOf(prev) === authorOf(message)
            && new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

          return (
            <div key={message.messageId} className={`wk-msg${mine ? ' is-mine' : ''}${same ? ' is-follow' : ''}`}>
              {!same && (
                <p className="wk-msg-author">
                  {authorName(message, opened)}
                  {message.authorSeatId !== null && <span className="wk-msg-link"> · z linku</span>}
                  <span className="wk-msg-time"> · {when(message.createdAt)}</span>
                </p>
              )}
              <div className="wk-msg-body">
                {message.deletedAt !== null
                  ? <em className="wk-row-side">wiadomość usunięta</em>
                  : opened === null
                    ? <em className="wk-row-side">Nie do odczytania — brak klucza tej epoki obszaru.</em>
                    : opened.text}
                {mine && message.deletedAt === null && (
                  <button type="button" className="wk-chip-x wk-msg-drop" aria-label="Usuń wiadomość" title="Usuń wiadomość"
                    onClick={() => {
                      if (!window.confirm('Usunąć tę wiadomość? Inni zobaczą, że była, ale nie jej treść.')) return;
                      void deleteMessage(message.messageId).then(() => setShown((was) => was.map((w) =>
                        w.message.messageId === message.messageId
                          ? { message: { ...w.message, deletedAt: new Date().toISOString(), bodySealed: null }, opened: null }
                          : w)));
                    }}>
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {speaker === null ? (
        <p className="wk-hint wk-chat-compose">W tej rozmowie tylko czytasz.</p>
      ) : (
        <form className="wk-chat-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <SpeakingAs
            speakers={speakers}
            speaker={speaker}
            nameOf={nameOf}
            onPick={pick}
            asked={speaker !== asRoleId && !speakers.includes(asRoleId) && persons.has(asRoleId) ? persons.get(asRoleId)! : null}
          />
          <div className="wk-chat-compose-row">
            <textarea
              value={text}
              rows={2}
              placeholder="Napisz wiadomość… (Enter wysyła, Shift+Enter — nowa linia)"
              aria-label="Wiadomość"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            />
            <button type="submit" className="wk-btn" disabled={busy || text.trim() === ''}>
              {busy ? 'Wysyłanie…' : 'Wyślij'}
            </button>
          </div>
          {failed !== null && <p className="wk-error">{failed}</p>}
        </form>
      )}
    </div>
  );
}

/**
 * „PISZESZ JAKO …" — über dem Feld, in der Rozmowa des Arbeitsplatzes und auf
 * der Seite gleich. Mit einer Wahl, wenn ich hier als mehr als eine meiner
 * Rollen schreiben darf; der Name ist der, den die anderen an der Nachricht sehen.
 *
 * `asked`: die oben gewählte Person, wenn SIE hier nicht schreiben darf — damit
 * niemand glaubt, er schreibe als sie.
 */
export function SpeakingAs({ speakers, speaker, nameOf, onPick, asked = null }: {
  speakers: readonly string[];
  speaker: string;
  nameOf: (id: string) => string | null;
  onPick: (id: string) => void;
  asked?: string | null;
}) {
  const label = (id: string) => nameOf(id) ?? `rola ${id.slice(0, 8)}`;

  return (
    <p className="wk-hint wk-chat-as">
      {speakers.length > 1 ? (
        <label>
          Piszesz jako{' '}
          <select value={speaker} aria-label="Piszesz jako" onChange={(e) => onPick(e.target.value)}>
            {speakers.map((id) => <option key={id} value={id}>{label(id)}</option>)}
          </select>
        </label>
      ) : (
        <>Piszesz jako <strong>{label(speaker)}</strong></>
      )}
      {asked !== null && <span className="wk-chat-as-note"> · {asked} nie pisze w tej grupie</span>}
    </p>
  );
}

export default PageChatCard;
