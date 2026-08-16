import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createEventTopic,
  getEventTopic,
  getEventTopics,
  moderateEventTopic,
  postEventTopicMessage,
  updateEventTopic,
  type EventTopic,
  type EventTopicMessage
} from '../../../lib/api';
import { useIsEventAdmin } from '../shell/useIsEventAdmin';
import { asOptionalText, asRecord, definePart } from './contracts';
import { AreaRow, TextRow } from './editorKit';
import { Fullscreen } from './Fullscreen';

type TopicsConfig = {
  intro: string | null;
  newTopicLabel: string | null;
  emptyMessage: string | null;
};

/** How often an open thread re-reads itself while somebody is looking at it. */
const REFRESH_MS = 15000;

function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return sameDay
    ? date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Questions participants ask each other.
 *
 * A list of topics rather than one long chat, on purpose: a chat is a river you
 * have to keep up with, and the same question gets asked in it four times a day.
 * A topic can be found already answered. The list therefore sorts by the last
 * reply, not by when a question was opened.
 *
 * Every message is signed, and the name is not typed by the writer — it comes
 * from the individual link they are reading with, so nobody can post as somebody
 * else, and somebody without a link cannot post at all.
 */
export const topicsPart = definePart<TopicsConfig>({
  kind: 'topics',
  label: 'Pytania uczestników',
  description: 'Tematy zakładane przez uczestników, z odpowiedziami. Wymaga linku osobistego — wiadomości są podpisane.',

  defaultConfig: () => ({
    intro: 'Masz pytanie? Załóż temat — odpowie organizator albo ktoś, kto już to przerabiał.',
    newTopicLabel: 'Nowy temat',
    emptyMessage: 'Nie ma jeszcze żadnego tematu. Możesz założyć pierwszy.'
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      intro: asOptionalText(record.intro),
      newTopicLabel: asOptionalText(record.newTopicLabel),
      emptyMessage: asOptionalText(record.emptyMessage)
    };
  },

  Renderer: ({ config, ctx }) => {
    const token = ctx.accessToken;
    const partId = ctx.part.id;

    const [topics, setTopics] = useState<EventTopic[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [composing, setComposing] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setTopics(await getEventTopics(token, partId));
        setError(null);
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać tematów.');
      } finally {
        setLoading(false);
      }
    }, [partId, token]);

    useEffect(() => {
      void load();
    }, [load]);

    if (!token) {
      return <p className="ev-note">Ta sekcja działa tylko z linku osobistego — wiadomości są podpisane imieniem.</p>;
    }
    if (loading) {
      return <p className="ev-note">Wczytywanie…</p>;
    }

    const create = async (event: FormEvent) => {
      event.preventDefault();
      if (title.trim().length === 0 || body.trim().length === 0) {
        setError('Podaj temat i treść pytania.');
        return;
      }

      setPending(true);
      setError(null);
      try {
        const created = await createEventTopic(token, partId, title.trim(), body.trim());
        setTitle('');
        setBody('');
        setComposing(false);
        await load();
        // Straight into the new thread: the author's next move is almost always
        // to watch for an answer.
        setOpenId(created.id);
      } catch (createError: unknown) {
        setError(createError instanceof Error ? createError.message : 'Nie udało się założyć tematu.');
      } finally {
        setPending(false);
      }
    };

    return (
      <div className="ev-topics">
        {config.intro ? <p className="ev-note">{config.intro}</p> : null}

        {composing ? (
          <form className="ev-topic-new" onSubmit={(event) => void create(event)}>
            <label className="ev-field">
              <span className="ev-field-label">Temat</span>
              <input
                type="text"
                value={title}
                maxLength={200}
                placeholder="O co pytasz?"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="ev-field">
              <span className="ev-field-label">Treść</span>
              <textarea rows={3} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} />
            </label>
            <div className="ev-actions">
              <button className="ev-cta" type="submit" disabled={pending}>
                {pending ? 'Zakładanie…' : 'Załóż temat'}
              </button>
              <button className="ev-ghost" type="button" onClick={() => setComposing(false)}>
                Anuluj
              </button>
            </div>
          </form>
        ) : (
          <button className="ev-cta" type="button" onClick={() => setComposing(true)}>
            + {config.newTopicLabel ?? 'Nowy temat'}
          </button>
        )}

        {error ? <p className="ev-error">{error}</p> : null}

        {topics.length === 0 ? (
          <p className="ev-note">{config.emptyMessage ?? 'Nie ma jeszcze żadnego tematu.'}</p>
        ) : (
          <ul className="ev-topic-list">
            {topics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  className={topic.status === 'closed' ? 'is-closed' : ''}
                  onClick={() => setOpenId(topic.id)}
                >
                  <span className="ev-topic-title">
                    {topic.title}
                    {/* Closed still opens and still reads — it just cannot be
                        written in, and saying so up front saves the trip. */}
                    {topic.status === 'closed' ? <span className="ev-topic-badge">zamknięty</span> : null}
                  </span>
                  <span className="ev-topic-meta">
                    {topic.authorName}
                    {topic.isMine ? ' (Ty)' : ''} · {topic.messageCount}{' '}
                    {topic.messageCount === 1 ? 'wiadomość' : 'wiadomości'} · {formatMoment(topic.lastMessageUtc)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {openId ? (
          <TopicThread
            token={token}
            partId={partId}
            topicId={openId}
            onClose={() => {
              setOpenId(null);
              void load();
            }}
          />
        ) : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <p className="eve-hint">
        Sekcja działa tylko za linkiem osobistym: podpis pod wiadomością bierze się z linku, więc nikt nie napisze
        pod cudzym imieniem. Na stronie publicznej pokaże się tylko informacja, że potrzebny jest link.
      </p>
      <AreaRow
        label="Wstęp"
        rows={2}
        value={config.intro ?? ''}
        onChange={(intro) => onChange({ ...config, intro: intro || null })}
      />
      <TextRow
        label="Napis na przycisku"
        value={config.newTopicLabel ?? ''}
        onChange={(newTopicLabel) => onChange({ ...config, newTopicLabel: newTopicLabel || null })}
      />
      <AreaRow
        label="Tekst, gdy nie ma tematów"
        rows={2}
        value={config.emptyMessage ?? ''}
        onChange={(emptyMessage) => onChange({ ...config, emptyMessage: emptyMessage || null })}
      />
    </>
  )
});

/** One thread, full screen: the messages, oldest first, and a box to answer in. */
function TopicThread({
  token,
  partId,
  topicId,
  onClose
}: {
  token: string;
  partId: string;
  topicId: string;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState<EventTopic | null>(null);
  const [messages, setMessages] = useState<EventTopicMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = useIsEventAdmin();

  const load = useCallback(async () => {
    try {
      const response = await getEventTopic(token, partId, topicId);
      setTopic(response.topic);
      setMessages(response.messages);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać wiadomości.');
    }
  }, [partId, token, topicId]);

  useEffect(() => {
    void load();
    // Nobody expects a live chat here, but a thread left open while waiting for
    // an answer should eventually show it without being reopened.
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim().length === 0) return;

    setPending(true);
    setError(null);
    try {
      await postEventTopicMessage(token, partId, topicId, draft.trim());
      setDraft('');
      await load();
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : 'Nie udało się wysłać wiadomości.');
    } finally {
      setPending(false);
    }
  };

  /**
   * The author's controls go through the link; the admin's go through the admin
   * endpoint, which is the only one that may disable. Both re-read afterwards
   * rather than patch the local copy — the answer from the server is the truth.
   */
  const patch = async (
    changes: { title?: string; status?: 'open' | 'closed' | 'disabled' },
    asAdmin: boolean
  ) => {
    setError(null);
    try {
      if (asAdmin) {
        await moderateEventTopic(topicId, changes);
      } else {
        await updateEventTopic(token, partId, topicId, changes as { title?: string; status?: 'open' | 'closed' });
      }
      // Disabling takes the topic out of circulation, so there is nothing left
      // to look at — step back to the list.
      if (changes.status === 'disabled') onClose();
      else await load();
    } catch (patchError: unknown) {
      setError(patchError instanceof Error ? patchError.message : 'Nie udało się zmienić tematu.');
    }
  };

  const saveTitle = async (event: FormEvent) => {
    event.preventDefault();
    const title = (renaming ?? '').trim();
    if (title.length === 0) return;
    await patch({ title }, !topic?.isMine && isAdmin);
    setRenaming(null);
  };

  return (
    <Fullscreen label={topic?.title ?? 'Temat'} onClose={onClose}>
      <div className="ev-thread">
        <header>
          {renaming !== null ? (
            <form className="ev-thread-rename" onSubmit={(event) => void saveTitle(event)}>
              <input
                type="text"
                value={renaming}
                maxLength={200}
                autoFocus
                onChange={(event) => setRenaming(event.target.value)}
              />
              <button className="ev-cta" type="submit">
                Zapisz
              </button>
              <button className="ev-ghost" type="button" onClick={() => setRenaming(null)}>
                Anuluj
              </button>
            </form>
          ) : (
            <h2>
              {topic?.title ?? '…'}
              {topic?.status === 'closed' ? <span className="ev-topic-badge">zamknięty</span> : null}
            </h2>
          )}

          <p>
            {topic ? `${topic.authorName} · ${formatMoment(topic.createdUtc)}` : ''}

            {topic && (topic.isMine || isAdmin) && renaming === null ? (
              <button type="button" className="ev-thread-tool" onClick={() => setRenaming(topic.title)}>
                Zmień tytuł
              </button>
            ) : null}

            {topic && (topic.isMine || isAdmin) ? (
              <button
                type="button"
                className="ev-thread-tool"
                onClick={() => void patch({ status: topic.status === 'open' ? 'closed' : 'open' }, !topic.isMine && isAdmin)}
              >
                {topic.status === 'open' ? 'Zamknij temat' : 'Otwórz ponownie'}
              </button>
            ) : null}

            {/* Only the organizer, and only ever hiding — the answers under a
                question belong to the people who wrote them. */}
            {topic && isAdmin ? (
              <button
                type="button"
                className="ev-thread-tool is-danger"
                onClick={() => {
                  if (window.confirm('Wyłączyć ten temat? Zniknie z listy, ale nic nie zostanie skasowane.')) {
                    void patch({ status: 'disabled' }, true);
                  }
                }}
              >
                Wyłącz
              </button>
            ) : null}
          </p>
        </header>

        <div className="ev-thread-messages">
          {messages.map((message) => (
            <article key={message.id} className={`ev-message ${message.isMine ? 'is-mine' : ''}`}>
              <header>
                <strong>{message.authorName}</strong>
                <time>{formatMoment(message.createdUtc)}</time>
              </header>
              <p>{message.body}</p>
            </article>
          ))}
          <div ref={endRef} />
        </div>

        {topic?.status === 'closed' ? (
          <p className="ev-thread-closed">
            Temat jest zamknięty — można go czytać, ale nie da się już w nim pisać.
          </p>
        ) : (
          <form className="ev-thread-compose" onSubmit={(event) => void send(event)}>
            <textarea
              rows={2}
              value={draft}
              maxLength={2000}
              placeholder="Napisz odpowiedź…"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="ev-cta" type="submit" disabled={pending || draft.trim().length === 0}>
              {pending ? 'Wysyłanie…' : 'Wyślij'}
            </button>
          </form>
        )}

        {error ? <p className="ev-error">{error}</p> : null}
      </div>
    </Fullscreen>
  );
}
