/**
 * TEMATY UND WAS DARAN HÄNGT (0068) — die Leiste über dem Verlauf einer
 * Rozmowa, und das Fenster „Zadania i terminy".
 *
 * <b>Ein Thema ist ein Filter und ein Ziel.</b> Wer eines wählt, sieht seine
 * Nachrichten, und was er schreibt, landet darin. „Wszystko" zeigt alles.
 *
 * <b>Aufgaben und Termine</b> entstehen aus einer Nachricht (Menü der
 * Nachricht) und merken sich Rozmowa, Thema und Nachricht; hier stehen sie
 * zusammen, nach Thema.
 */

import { useEffect, useState } from 'react';

import { areaKeys } from './chat';
import { closeTopic, loadLinked, renameTopic, type LinkedItem, type Topic } from './chatTopics';
import { aad, Field, fromBase64Url, openText } from './crypto';
import type { Ring } from './keys';
import { Modal } from './Modal';
import { viewPath } from './routes';
import { WorkspaceError } from './session';
import { loadTasks, openTasks, windowState, type OpenTask } from './tasks';

export function TopicBar({ topics, current, canCreate, canManage, onPick, onCreate, onChanged }: {
  topics: readonly Topic[];
  current: string | null;
  canCreate: boolean;
  /** Umbenennen, schliessen (wer moderiert oder es angelegt hat — der Dienst prüft). */
  canManage: boolean;
  onPick: (topicId: string | null) => void;
  onCreate: (title: string) => Promise<void>;
  onChanged?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const open = topics.filter((t) => t.closedAt === null);
  const closed = topics.filter((t) => t.closedAt !== null);
  const chosen = topics.find((t) => t.topicId === current) ?? null;

  if (topics.length === 0 && !canCreate) return null;

  const make = async () => {
    if (title.trim() === '') return;
    setBusy(true);
    setFailed(null);
    try {
      await onCreate(title);
      setTitle('');
      setAdding(false);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć tematu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-topics" role="toolbar" aria-label="Tematy">
      <div className="ch-topics-row">
        <button type="button" className={current === null ? 'ch-topic is-on' : 'ch-topic'} onClick={() => onPick(null)}>Wszystko</button>
        {[...open, ...(showClosed ? closed : [])].map((t) => (
          <button key={t.topicId} type="button" className={`ch-topic${current === t.topicId ? ' is-on' : ''}${t.closedAt !== null ? ' is-closed' : ''}`}
            title={`${t.messages} wiad.${t.tasks > 0 ? ` · ${t.tasks} zad.` : ''}${t.items > 0 ? ` · ${t.items} term.` : ''}`}
            onClick={() => onPick(current === t.topicId ? null : t.topicId)}>
            # {t.title}
            {(t.tasks > 0 || t.items > 0) && <span className="ch-topic-n">{t.tasks + t.items}</span>}
          </button>
        ))}
        {closed.length > 0 && (
          <button type="button" className="ch-topic is-quiet" onClick={() => setShowClosed((was) => !was)}>
            {showClosed ? 'Ukryj zamknięte' : `Zamknięte (${closed.length})`}
          </button>
        )}
        {canCreate && !adding && (
          <button type="button" className="ch-topic is-add" onClick={() => setAdding(true)}>+ Temat</button>
        )}
      </div>

      {adding && (
        <form className="ch-topic-new" onSubmit={(e) => { e.preventDefault(); void make(); }}>
          <input autoFocus value={title} maxLength={200} placeholder="np. Pielgrzymka — transport" disabled={busy}
            onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="wk-btn" disabled={busy || title.trim() === ''}>Załóż</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setAdding(false); setTitle(''); }}>Anuluj</button>
        </form>
      )}

      {chosen !== null && canManage && (
        <TopicTools topic={chosen} onChanged={onChanged} />
      )}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}
    </div>
  );
}

function TopicTools({ topic, onChanged }: { topic: Topic; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="ch-topic-tools">
      <span className="wk-hint">Piszesz w temacie „{topic.title}"</span>
      <button type="button" className="wk-link-btn" disabled={busy}
        onClick={() => { setBusy(true); void closeTopic(topic.topicId, topic.closedAt === null).then(() => onChanged?.()).finally(() => setBusy(false)); }}>
        {topic.closedAt === null ? 'Zamknij temat' : 'Otwórz ponownie'}
      </button>
    </div>
  );
}

/** Umbenennen — ein kleines Fenster. */
export function RenameTopic({ topic, keys, onClose, onDone }: {
  topic: Topic; keys: ReadonlyMap<number, Uint8Array>; onClose: () => void; onDone: () => void;
}) {
  const [title, setTitle] = useState(topic.title);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <Modal title="Nazwa tematu" onClose={onClose}>
      <form className="wk-form" onSubmit={(e) => {
        e.preventDefault();
        void renameTopic(topic.topicId, keys, title).then(() => { onDone(); onClose(); })
          .catch((err) => setFailed(err instanceof WorkspaceError ? err.message : 'Nie udało się.'));
      }}>
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions"><button type="submit" className="wk-btn">Zapisz</button></div>
      </form>
    </Modal>
  );
}

/** Wohin eine Nachricht gehört — ein Thema oder keines. */
export function MoveToTopic({ topics, current, onPick, onClose }: {
  topics: readonly Topic[]; current: string | null; onPick: (topicId: string | null) => void; onClose: () => void;
}) {
  return (
    <Modal title="Przenieś do tematu" onClose={onClose}>
      <ul className="ch-move-list">
        <li><button type="button" className={current === null ? 'ch-topic is-on' : 'ch-topic'} onClick={() => onPick(null)}>Bez tematu</button></li>
        {topics.filter((t) => t.closedAt === null).map((t) => (
          <li key={t.topicId}>
            <button type="button" className={current === t.topicId ? 'ch-topic is-on' : 'ch-topic'} onClick={() => onPick(t.topicId)}># {t.title}</button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const itemTitleAad = (itemId: string) => aad('calendar', 'item', itemId, Field.CalendarEventTitle, 1);

/**
 * „ZADANIA I TERMINY" — was aus dieser Rozmowa entstanden ist, nach Thema.
 * Aufgaben mit ihrem Zustand (zu tun, erledigt, versäumt), Termine mit Zeit.
 */
export function LinkedDialog({ ring, chatId, topics, onClose }: {
  ring: Ring; chatId: string; topics: readonly Topic[]; onClose: () => void;
}) {
  const [tasks, setTasks] = useState<readonly OpenTask[] | null>(null);
  const [items, setItems] = useState<readonly (LinkedItem & { title: string })[] | null>(null);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    void loadTasks(new Date(now - 30 * 86400_000), new Date(now + 90 * 86400_000), chatId)
      .then(({ tasks: rows }) => openTasks(ring, rows))
      .then((opened) => { if (alive) setTasks(opened); })
      .catch(() => { if (alive) setTasks([]); });
    void loadLinked(chatId)
      .then(async ({ items: rows }) => Promise.all(rows.map(async (row) => {
        let title = row.titlePublic ?? 'Termin';
        const sealed = row.fields.find((f) => f.field === 'title');
        if (sealed !== undefined) {
          try {
            const key = (await areaKeys(ring, sealed.areaId)).get(sealed.epoch);
            if (key !== undefined) title = await openText(key, itemTitleAad(row.itemId), fromBase64Url(sealed.sealed));
          } catch { /* offener Titel */ }
        }
        return { ...row, title };
      })))
      .then((opened) => { if (alive) setItems(opened); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [ring, chatId]);

  const groups: { topicId: string | null; title: string }[] = [
    ...topics.map((t) => ({ topicId: t.topicId as string | null, title: `# ${t.title}` })),
    { topicId: null, title: 'Bez tematu' }
  ];
  const now = new Date();

  return (
    <Modal title="Zadania i terminy z tej rozmowy" wide onClose={onClose}>
      {tasks === null || items === null ? <p className="wk-hint">Wczytywanie…</p>
        : tasks.length === 0 && items.length === 0 ? (
          <p className="wk-empty">Nic jeszcze nie powstało z tej rozmowy. W menu wiadomości wybierz „Utwórz zadanie" albo „Dodaj do kalendarza".</p>
        ) : (
          <div className="ch-linked">
            {groups.map((g) => {
              const ts = tasks.filter((t) => (t.topicId ?? null) === g.topicId);
              const is = items.filter((i) => i.topicId === g.topicId);
              if (ts.length === 0 && is.length === 0) return null;
              return (
                <section key={g.topicId ?? 'none'} className="ch-linked-group">
                  <h3 className="wk-h3">{g.title}</h3>
                  <ul>
                    {ts.map((t) => {
                      const next = t.occurrences.find((o) => windowState(o, now) !== 'done' && windowState(o, now) !== 'skipped');
                      const state = t.kind === 'after' ? (t.dueAt !== null && new Date(t.dueAt) < now ? 'zaległe' : 'co pewien czas')
                        : next === undefined ? 'zrobione' : windowState(next, now) === 'open' ? 'teraz' : windowState(next, now) === 'missed' ? 'przegapione' : 'zaplanowane';
                      return (
                        <li key={t.taskId}>
                          <a href={viewPath('tasks')}>Zadanie: {t.title}</a> <span className="wk-tag">{state}</span>
                        </li>
                      );
                    })}
                    {is.map((i) => (
                      <li key={i.itemId}>
                        <a href={viewPath('calendar')}>Termin: {i.title}</a>{' '}
                        <span className="wk-hint">{new Date(i.startsAt).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {i.status === 'cancelled' && <span className="wk-tag">odwołany</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
    </Modal>
  );
}
