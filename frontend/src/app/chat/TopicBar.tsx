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

import { closeTopic, loadLinked, openLinked, type LinkedItem, type Topic } from './chatTopics';
import type { Ring } from '../core/keys';
import { Modal } from '../ui/Modal';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { loadTasks, openTasks, windowState, type OpenTask } from '../calendar/tasks';
import { Loading } from '../ui/Loading';
import { fmtDate, t as tApp, useT } from '../core/i18n';

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
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const open = topics.filter((tp) => tp.closedAt === null);
  const closed = topics.filter((tp) => tp.closedAt !== null);
  const chosen = topics.find((tp) => tp.topicId === current) ?? null;

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
      setFailed(e instanceof WorkspaceError ? e.message : t('chat.topic.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-topics" role="toolbar" aria-label={t('chat.topic.label')}>
      <div className="ch-topics-row">
        <button type="button" className={current === null ? 'ch-topic is-on' : 'ch-topic'} onClick={() => onPick(null)}>{t('chat.topic.all')}</button>
        {[...open, ...(showClosed ? closed : [])].map((tp) => (
          <button key={tp.topicId} type="button" className={`ch-topic${current === tp.topicId ? ' is-on' : ''}${tp.closedAt !== null ? ' is-closed' : ''}`}
            title={`${t('chat.topic.nMessages', { count: tp.messages })}${tp.tasks > 0 ? ` · ${t('chat.topic.nTasks', { count: tp.tasks })}` : ''}${tp.items > 0 ? ` · ${t('chat.topic.nItems', { count: tp.items })}` : ''}`}
            onClick={() => onPick(current === tp.topicId ? null : tp.topicId)}>
            # {tp.title}
            {(tp.tasks > 0 || tp.items > 0) && <span className="ch-topic-n">{tp.tasks + tp.items}</span>}
          </button>
        ))}
        {closed.length > 0 && (
          <button type="button" className="ch-topic is-quiet" onClick={() => setShowClosed((was) => !was)}>
            {showClosed ? t('chat.topic.hideClosed') : t('chat.topic.closed', { count: closed.length })}
          </button>
        )}
        {canCreate && !adding && (
          <button type="button" className="ch-topic is-add" onClick={() => setAdding(true)}>{t('chat.topic.add')}</button>
        )}
      </div>

      {adding && (
        <form className="ch-topic-new" onSubmit={(e) => { e.preventDefault(); void make(); }}>
          <input autoFocus value={title} maxLength={200} placeholder={t('chat.topic.newHint')} disabled={busy}
            onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="wk-btn" disabled={busy || title.trim() === ''}>{t('chat.topic.create')}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setAdding(false); setTitle(''); }}>{t('common.cancel')}</button>
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
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <div className="ch-topic-tools">
      <span className="wk-hint">{t('chat.topic.writingIn', { title: topic.title })}</span>
      <button type="button" className="wk-link-btn" disabled={busy}
        onClick={() => { setBusy(true); void closeTopic(topic.topicId, topic.closedAt === null).then(() => onChanged?.()).finally(() => setBusy(false)); }}>
        {topic.closedAt === null ? t('chat.topic.close') : t('chat.topic.reopen')}
      </button>
    </div>
  );
}

/** Wohin eine Nachricht gehört — ein Thema oder keines. */
/**
 * 0101 — IN EIN THEMA ZUSAMMENTRAGEN: ein neues Thema (gleich mit den
 * markierten Nachrichten darin) oder ein bestehendes — oder heraus aus jedem.
 * Eine einzelne Nachricht („Przenieś do tematu") geht denselben Weg.
 */
export function CollectToTopic({ count, topics, canCreate, onCollect, onClose }: {
  count: number;
  topics: readonly Topic[];
  canCreate: boolean;
  onCollect: (target: { readonly topicId: string | null } | { readonly title: string }) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const open = topics.filter((tp) => tp.closedAt === null);

  const go = async (target: { readonly topicId: string | null } | { readonly title: string }) => {
    setBusy(true);
    setFailed(null);
    try {
      await onCollect(target);
    } catch (e) {
      setFailed(e instanceof Error && e.message !== '' ? e.message : t('chat.topic.moveFailed'));
      setBusy(false);
    }
  };

  return (
    <Modal title={count === 1 ? t('chat.topic.moveTitle') : t('chat.topic.collectTitle', { count })} onClose={onClose}>
      {canCreate && (
        <form className="ch-collect-new" onSubmit={(e) => { e.preventDefault(); if (title.trim() !== '') void go({ title: title.trim() }); }}>
          <label className="wk-field">
            <span>{t('chat.topic.new')}</span>
            <input value={title} autoFocus maxLength={200} placeholder={t('chat.topic.collectHint')} disabled={busy} data-collect-title=""
              onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button type="submit" className="wk-btn" disabled={busy || title.trim() === ''} data-collect-new="">
            {busy ? t('chat.topic.moving') : count === 1 ? t('chat.topic.createMove') : t('chat.topic.createCollect')}
          </button>
        </form>
      )}
      {open.length > 0 && <p className="wk-hint">{canCreate ? t('chat.topic.orExisting') : t('chat.topic.toTopic')}</p>}
      <ul className="ch-move-list">
        {open.map((tp) => (
          <li key={tp.topicId}>
            <button type="button" className="ch-topic" disabled={busy} data-collect-topic={tp.topicId} onClick={() => void go({ topicId: tp.topicId })}># {tp.title}</button>
          </li>
        ))}
        <li><button type="button" className="ch-topic" disabled={busy} data-collect-topic="" onClick={() => void go({ topicId: null })}>{t('chat.topic.none')}</button></li>
      </ul>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Modal>
  );
}

/**
 * Wie es um eine Aufgabe aus der Rozmowa steht — in Worten.
 * 2026-10-29 — auch im Export der Rozmowa (`ChatJsonDialog`), dieselben Worte.
 */
export function taskState(task: OpenTask, now: Date): string {
  const t = tApp;
  const next = task.occurrences.find((o) => windowState(o, now) !== 'done' && windowState(o, now) !== 'skipped');
  return task.kind === 'after' ? (task.dueAt !== null && new Date(task.dueAt) < now ? t('chat.taskState.overdue') : t('chat.taskState.recurring'))
    : next === undefined ? t('chat.taskState.done') : windowState(next, now) === 'open' ? t('chat.taskState.now') : windowState(next, now) === 'missed' ? t('chat.taskState.missed') : t('chat.taskState.planned');
}

/**
 * „ZADANIA I TERMINY" — was aus dieser Rozmowa entstanden ist, nach Thema.
 * Aufgaben mit ihrem Zustand (zu tun, erledigt, versäumt), Termine mit Zeit.
 */
export function LinkedDialog({ ring, chatId, topics, onClose }: {
  ring: Ring; chatId: string; topics: readonly Topic[]; onClose: () => void;
}) {
  const t = useT();
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
      .then(({ items: rows }) => openLinked(ring, rows))
      .then((opened) => { if (alive) setItems(opened); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [ring, chatId]);

  const groups: { topicId: string | null; title: string }[] = [
    ...topics.map((tp) => ({ topicId: tp.topicId as string | null, title: `# ${tp.title}` })),  // i18n-ignore
    { topicId: null, title: t('chat.topic.none') }
  ];
  const now = new Date();

  return (
    <Modal title={t('chat.linked.title')} wide onClose={onClose}>
      {tasks === null || items === null ? <Loading label={t('common.loading')} />
        : tasks.length === 0 && items.length === 0 ? (
          <p className="wk-empty">{t('chat.linked.empty')}</p>
        ) : (
          <div className="ch-linked">
            {groups.map((g) => {
              const ts = tasks.filter((task) => (task.topicId ?? null) === g.topicId);
              const is = items.filter((i) => i.topicId === g.topicId);
              if (ts.length === 0 && is.length === 0) return null;
              return (
                <section key={g.topicId ?? 'none'} className="ch-linked-group">
                  <h3 className="wk-h3">{g.title}</h3>
                  <ul>
                    {ts.map((task) => (
                      <li key={task.taskId}>
                        <a href={viewPath('tasks')}>{t('chat.linked.task', { title: task.title })}</a> <span className="wk-tag">{taskState(task, now)}</span>
                      </li>
                    ))}
                    {is.map((i) => (
                      <li key={i.itemId}>
                        <a href={viewPath('calendar')}>{t('chat.linked.item', { title: i.title })}</a>{' '}
                        <span className="wk-hint">{fmtDate(new Date(i.startsAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, t.lang)}</span>
                        {i.status === 'cancelled' && <span className="wk-tag">{t('chat.linked.cancelled')}</span>}
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
