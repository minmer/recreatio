/**
 * 2026-10-29 — „ROZMOWA JAKO JSON" (⋮ einer Rozmowa): Zeitraum oder Thema wählen und exportieren; importieren, was
 * `chatJson.ts` zulässt. Gelesen und geschrieben wird mit den Wegen der Rozmowa — versiegelt wie von Hand,
 * unterschrieben von der Rolle, als die Person, die gerade schreibt (0095), mit „Z importu" in der Hülle.
 *
 * <b>Was der Import über die Rozmowa weiss</b>, ist das, was hier geladen ist: die letzten 30 Tage — und so weit
 * zurück, wie das eingefügte Dokument reicht (`neededFrom`, höchstens `MAX_EXPORT` Nachrichten). Wer nur liest,
 * lädt nichts dafür: er hat den Export.
 *
 * Erst geladen, wenn das Fenster aufgeht (`later` in `ChatRoom`) — das Fach zieht den Leser der Seiten nach sich.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { loadTasks, openTasks } from '../calendar/tasks';
import type { Ring } from '../core/keys';
import { rich, t as tApp, useT } from '../core/i18n';
import { useRemembered } from '../core/prefs';
import { call, WorkspaceError } from '../core/session';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import { Segment } from '../ui/Segment';
import { type ChatDetail, type Opened, type SealedMessage, loadMessages, openMessage, sendMessage } from './chat';
import type { Speaker } from './chatAuthor';
import { chatEndpoint, type Features } from './chatFeatures';
import {
  CHAT_JSON, MAX_EXPORT, readOnlyImport, exportChat, importContext, neededFrom, planChatImport,
  type ChatImportPlan, type ExportItem, type LinkedEntry, type TopicTarget
} from './chatJson';
import { type Topic, closeTopic, collectToTopic, createTopic, loadLinked, loadTopics, openLinked, openTopics, renameTopic } from './chatTopics';
import { taskState } from './TopicBar';

const DAY = 86_400_000;
/** So viele auf einmal — der Dienst gibt bis 200 je Seite. */
const PAGE = 200;
/** Was der Import ohne Dokument kennt: die letzten Tage (für Antworten und was schon aus einem Import kam). */
const CONTEXT_DAYS = 30;

type Range = '7' | '30' | '90' | '365' | 'all';
const RANGES: readonly { value: Range; label: string }[] = [
  { value: '7', label: 'chatJson.dialog.range7' },
  { value: '30', label: 'chatJson.dialog.range30' },
  { value: '90', label: 'chatJson.dialog.range90' },
  { value: '365', label: 'chatJson.dialog.range365' },
  { value: 'all', label: 'chatJson.dialog.rangeAll' }
];

const startOf = (range: Range, now: number): number | null => (range === 'all' ? null : now - Number(range) * DAY);

const said = (e: unknown, fallback?: string): string => (e instanceof Error && e.message !== '' ? e.message : fallback ?? tApp('chatJson.run.failed'));

/** Ein Dateiname aus dem Namen der Rozmowa. */
const fileSlug = (text: string): string => text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rozmowa'; // i18n-ignore

/* -- Laden ------------------------------------------------------------------------------------------- */

export interface Loaded {
  /** Die älteste zuerst. */
  readonly items: readonly ExportItem[];
  /** Die älteste geladene — und wie weit zurück gefragt war (`null`: bis zum Anfang). */
  readonly from: string | null;
  readonly until: number | null;
  /** Davor gibt es keine mehr. */
  readonly complete: boolean;
  /** `MAX_EXPORT` hat vor `until` aufgehört. */
  readonly limited: boolean;
}

/**
 * Von der neuesten zurück, bis `until` (`null`: bis zum Anfang) — höchstens `MAX_EXPORT`, geöffnet mit `keys`.
 * Hinaus für die Prüfung (`app-json-chat-check.mjs`, gegen einen nachgebauten Dienst).
 */
export async function loadBack(chatId: string, keys: ReadonlyMap<number, Uint8Array>, until: number | null): Promise<Loaded> {
  const pages: ExportItem[][] = [];
  let count = 0;
  let oldest: SealedMessage | null = null;
  let complete = false;
  for (;;) {
    const page: { limit: number; before?: string; beforeId?: string } = oldest === null
      ? { limit: PAGE } : { limit: PAGE, before: oldest.createdAt, beforeId: oldest.messageId };
    const { messages } = await loadMessages(chatId, page);
    pages.unshift(await Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(keys, message) }))));
    count += messages.length;
    if (messages.length < PAGE) { complete = true; break; }
    oldest = messages[0];
    if (until !== null && Date.parse(oldest.createdAt) <= until) break;
    if (count >= MAX_EXPORT) break;
  }
  const items = pages.flat();
  const from = items.length === 0 ? null : items[0].message.createdAt;
  return { items, from, until, complete, limited: !complete && (until === null || (from !== null && Date.parse(from) > until)) };
}

/** Reicht das Geladene bis `need` zurück — oder weiter geht es nicht? */
export const covers = (loaded: Loaded, need: number | null): boolean =>
  need === null || loaded.complete || (loaded.from !== null && Date.parse(loaded.from) <= need)
  || (loaded.limited && (loaded.until === null || loaded.until <= need));

/** Aufgaben und Termine aus der Rozmowa — geöffnet; was nicht geht, fehlt (der Export geht trotzdem). */
async function linkedOf(ring: Ring, chatId: string, from: Date | null, now: Date): Promise<LinkedEntry[]> {
  const out: LinkedEntry[] = [];
  try {
    const { tasks } = await loadTasks(from ?? new Date(now.getTime() - 2 * 365 * DAY), new Date(now.getTime() + 365 * DAY), chatId);
    for (const t of await openTasks(ring, tasks)) {
      const next = t.occurrences.find((o) => o.doneAt === null && o.skippedAt === null) ?? t.occurrences[t.occurrences.length - 1];
      out.push({ kind: 'task', title: t.title, topicId: t.topicId ?? null, messageId: t.messageId ?? null, at: t.dueAt ?? next?.at ?? t.startsAt, end: null, state: taskState(t, now) });
    }
  } catch {
    // Ohne Aufgaben.
  }
  try {
    const { items } = await loadLinked(chatId);
    for (const i of await openLinked(ring, items)) {
      out.push({ kind: 'appointment', title: i.title, topicId: i.topicId, messageId: null, at: i.startsAt, end: i.endsAt, state: tApp(i.status === 'cancelled' ? 'chatJson.state.cancelled' : 'chatJson.state.planned') });
    }
  } catch {
    // Ohne Termine.
  }
  return out;
}

/* -- Das Fenster ------------------------------------------------------------------------------------------- */

export interface ChatJsonDialogProps {
  readonly chat: ChatDetail;
  /** Wie die Rozmowa im Kopf heisst. */
  readonly title: string;
  readonly ring: Ring;
  /** Die Chatschlüssel (aus denen des Bereichs abgeleitet). */
  readonly talk: ReadonlyMap<number, Uint8Array>;
  readonly topics: readonly Topic[];
  readonly features: Features | null;
  /** Die eigenen geplanten — was schon wartet, geht nicht zweimal. */
  readonly scheduled: readonly { readonly preview: string; readonly sendAt: string }[];
  /** Wer schreibt (`null`: niemand), wie er in der Rozmowa heisst, und was in die Hülle geht. */
  readonly speaker: Speaker | null;
  readonly speakerName: string | null;
  readonly personName: string | null;
  readonly via: string | null;
  readonly writes: boolean;
  readonly moderates: boolean;
  /** Der Verfasser, wie die anderen ihn sehen (ohne „Ty"). */
  readonly author: (message: SealedMessage, opened: Opened | null) => string;
  readonly mine: (message: SealedMessage) => boolean;
  readonly mayFile: (message: SealedMessage) => boolean;
  readonly topicBy: (topic: Topic) => string | null;
  readonly topicMayChange: (topic: Topic) => boolean;
  /** Nach dem Import: welche Nachrichten jetzt in welchem Thema sind (`null`: ohne). */
  readonly onImported: (moved: ReadonlyMap<string, string | null>) => void;
  readonly onClose: () => void;
}

export function ChatJsonDialog(props: ChatJsonDialogProps) {
  const t = useT();
  const { chat, ring, talk } = props;
  const endpoint = chatEndpoint(chat.chatId);
  const canImport = props.writes || props.moderates;
  const [picked, setPicked] = useRemembered('chat.json.range', '30');
  const range: Range = RANGES.find((r) => r.value === picked)?.value ?? '30';
  const [topicId, setTopicId] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [need, setNeed] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const asked = useRef<number | null>(null);
  /* Die Funktionen der Rozmowa wechseln mit jedem Zeichnen — gelesen wird die jüngste. */
  const latest = useRef(props);
  latest.current = props;

  /* Was der Import kennt: die letzten Tage, und so weit zurück, wie das Dokument reicht. Wer nur liest, braucht es nicht. */
  useEffect(() => {
    if (!canImport) return undefined;
    let alive = true;
    const until = Math.min(Date.now() - CONTEXT_DAYS * DAY, need ?? Number.POSITIVE_INFINITY);
    setFailed(null);
    void loadBack(chat.chatId, talk, until)
      .then((got) => { if (alive) setLoaded(got); })
      .catch((e: unknown) => { if (alive) setFailed(said(e, t('chatJson.dialog.loadFailed'))); });
    return () => { alive = false; };
  }, [canImport, chat.chatId, talk, need, round, t]);

  const context = useMemo(() => {
    if (loaded === null) return null;
    const p = latest.current;
    return importContext({
      chatId: chat.chatId,
      kind: chat.kind,
      now: new Date(),
      writes: p.writes,
      moderates: p.moderates,
      me: [p.speakerName, p.personName].filter((name): name is string => name !== null),
      topics: p.topics,
      topicMayChange: p.topicMayChange,
      items: loaded.items,
      look: { author: p.author, mine: p.mine },
      mayFile: p.mayFile,
      marks: p.features?.marks ?? [],
      from: loaded.from,
      complete: loaded.complete,
      scheduled: p.scheduled.map((s) => ({ text: s.preview, sendAt: s.sendAt }))
    });
  }, [loaded, chat.chatId, chat.kind, props.topics, props.features, props.scheduled, props.speaker, props.writes, props.moderates]);

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    if (!canImport) return { error: readOnlyImport() };
    if (failed !== null) return { error: failed };
    if (loaded === null || context === null) return { error: t('chatJson.dialog.loading') };
    const needed = neededFrom(doc, chat.chatId);
    if (!covers(loaded, needed)) {
      /* Das Dokument reicht weiter zurück: nachladen (nach dem Zeichnen), dann plant das Fach von selbst neu. */
      if (asked.current !== needed) {
        asked.current = needed;
        window.setTimeout(() => setNeed(needed), 0);
      }
      return { error: t('chatJson.dialog.loadingOlder') };
    }
    const plan = planChatImport(doc, { ...context, now: new Date() });
    return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
  };

  const exportDoc = async (): Promise<unknown> => {
    const p = latest.current;
    const now = new Date();
    const from = startOf(range, now.getTime());
    const [fresh, features, topics, linked] = await Promise.all([
      loadBack(chat.chatId, talk, from),
      call<Features>(`${endpoint}/features`).catch(() => p.features),
      loadTopics(endpoint).then(({ topics: rows }) => openTopics(talk, rows)).catch(() => p.topics),
      linkedOf(ring, chat.chatId, from === null ? null : new Date(from), now)
    ]);
    /* Was der Import kennt, so frisch wie der Export — sonst fehlten ihm Nachrichten, die seither kamen. */
    if (canImport) setRound((n) => n + 1);
    return exportChat({
      chat: { chatId: chat.chatId, kind: chat.kind, title: p.title },
      me: { name: p.speakerName, writes: p.writes, moderates: p.moderates },
      at: now,
      from: from === null ? null : new Date(from),
      topicId: topicId === '' ? null : topicId,
      limited: fresh.limited,
      topics,
      topicBy: p.topicBy,
      items: fresh.items,
      look: { author: p.author, mine: p.mine },
      marks: features?.marks ?? [],
      linked
    });
  };

  /** DER PLAN, AUSGEFÜHRT — mit den Wegen der Rozmowa; was scheitert, steht als Warnung da, der Rest geht weiter. */
  const run = async (plan: ChatImportPlan, stage: (what: string) => void) => {
    const p = latest.current;
    const lines: string[] = [];
    const warnings = [...plan.warnings];
    const moved = new Map<string, string | null>();
    const created = new Map<string, string>();
    const topicOf = (to: TopicTarget): string | null | undefined => (to.kind === 'none' ? null : to.kind === 'topic' ? to.topicId : created.get(to.ref));

    for (const [i, tp] of plan.newTopics.entries()) {
      stage(t('chatJson.run.creatingTopics', { n: i + 1, count: plan.newTopics.length }));
      try {
        const id = await createTopic(endpoint, talk, tp.title, p.speaker?.roleId ?? null);
        created.set(tp.ref, id);
        if (tp.closed) await closeTopic(id, true);
        lines.push(t(tp.closed ? 'chatJson.run.newTopicClosed' : 'chatJson.run.newTopic', { title: tp.title }));
      } catch (e) {
        warnings.push(t('chatJson.run.topicFailed', { title: tp.title, error: said(e) }));
      }
    }

    for (const c of plan.topicChanges) {
      stage(t('chatJson.run.changingTopics'));
      try {
        if (c.title !== undefined) {
          await renameTopic(talk, c.topicId, c.title);
          lines.push(t('chatJson.plan.line.rename', { was: c.was, title: c.title }));
        }
        if (c.closed !== undefined) {
          await closeTopic(c.topicId, c.closed);
          lines.push(t(c.closed ? 'chatJson.run.closed' : 'chatJson.run.reopened', { title: c.title ?? c.was }));
        }
      } catch (e) {
        warnings.push(t('chatJson.run.topicError', { title: c.was, error: said(e) }));
      }
    }

    /* Ordnen: je Ziel einmal (der Dienst nimmt bis 500 auf einmal). */
    const groups = new Map<string, { to: string | null; ids: string[] }>();
    let lost = 0;
    for (const m of plan.moves) {
      const to = topicOf(m.to);
      if (to === undefined) { lost += 1; continue; }
      const group = groups.get(to ?? '') ?? { to, ids: [] };
      group.ids.push(m.messageId);
      groups.set(to ?? '', group);
    }
    if (lost > 0) warnings.push(t('chatJson.run.lost', { count: lost }));
    let notYours = 0;
    for (const group of groups.values()) {
      stage(t('chatJson.run.sorting'));
      for (let at = 0; at < group.ids.length; at += 500) {
        try {
          const done = await collectToTopic(chat.chatId, group.ids.slice(at, at + 500), group.to);
          for (const id of done.moved) moved.set(id, group.to);
          notYours += done.notYours;
        } catch (e) {
          warnings.push(t('chatJson.run.moveError', { error: said(e) }));
        }
      }
    }
    if (moved.size > 0) lines.push(t('chatJson.run.moved', { count: moved.size }));
    if (notYours > 0) warnings.push(t('chatJson.run.notYours', { count: notYours }));

    let marked = 0;
    for (const mark of plan.marks) {
      stage(t('chatJson.run.marking'));
      try {
        await call(`${endpoint}/marks`, { method: 'POST', body: JSON.stringify({ messageId: mark.messageId, kind: mark.kind, value: mark.on ? '1' : null }) });
        marked += 1;
      } catch (e) {
        warnings.push(t(mark.kind === 'pin' ? 'chatJson.run.pinError' : 'chatJson.run.starError', { error: said(e) }));
      }
    }
    if (marked > 0) lines.push(t('chatJson.run.marked', { count: marked }));

    /* Neue Nachrichten zuletzt — der Reihe nach; scheitert eine, gehen die danach nicht (die Reihenfolge bliebe nicht). */
    const speaker = p.speaker;
    let sent = 0;
    let planned = 0;
    if (speaker === null) {
      if (plan.posts.length > 0) warnings.push(t('chatJson.run.notWriting'));
    } else {
      for (const [i, post] of plan.posts.entries()) {
        stage(t('chatJson.run.sending', { n: i + 1, count: plan.posts.length }));
        const to = topicOf(post.to);
        if (to === undefined) warnings.push(t('chatJson.run.noTopic', { n: i + 1, count: plan.posts.length }));
        try {
          await sendMessage(ring, chat.chatId, talk, speaker.roleId, post.text, p.personName, {
            imported: true,
            personId: speaker.personId,
            via: p.via,
            topicId: to ?? null,
            ...(post.replyTo !== null ? { replyTo: post.replyTo, replyText: post.replyText ?? '' } : {}),
            ...(post.sendAt !== null ? { sendAt: post.sendAt } : {}),
            ...(post.silent ? { silent: true } : {})
          });
          if (post.sendAt === null) sent += 1; else planned += 1;
        } catch (e) {
          const left = plan.posts.length - i - 1;
          warnings.push(t('chatJson.run.sendFailed', { n: i + 1, count: plan.posts.length, error: said(e) }) + (left > 0 ? ` ${t('chatJson.run.rest', { left })}` : ''));
          break;
        }
      }
    }
    if (sent > 0) lines.push(t('chatJson.run.sent', { count: sent, name: p.speakerName ?? t('chat.you') }));
    if (planned > 0) lines.push(t('chatJson.run.planned', { count: planned }));
    if (lines.length === 0) lines.push(t('chatJson.run.nothing'));
    return { lines, warnings, moved };
  };

  const onImport = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (!canImport) throw new WorkspaceError(readOnlyImport());
    if (loaded === null || context === null) throw new WorkspaceError(t('chatJson.dialog.stillLoading'));
    if (!covers(loaded, neededFrom(doc, chat.chatId))) throw new WorkspaceError(t('chatJson.dialog.olderLoading'));
    const plan = planChatImport(doc, { ...context, now: new Date() });
    if ('error' in plan) throw new WorkspaceError(plan.error);
    const done = await run(plan, stage);
    latest.current.onImported(done.moved);
    setRound((n) => n + 1);
    return { lines: done.lines, warnings: done.warnings };
  };

  return (
    <Modal title={t('chat.room.json')} wide onClose={props.onClose}>
      <div className="ch-json-range" data-chat-json="">
        <fieldset className="wk-field">
          <legend>{t('chatJson.dialog.period')}</legend>
          <Segment now={range} options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} busy={false} onPick={(value) => setPicked(value)} />
        </fieldset>
        {props.topics.length > 0 && (
          <label className="wk-field">
            <span>{t('chatJson.dialog.topic')}</span>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">{t('chatJson.dialog.allMessages')}</option>
              {props.topics.map((tp) => (
                <option key={tp.topicId} value={tp.topicId}>{`# ${tp.title}${tp.closedAt !== null ? ` ${t('chatJson.dialog.closed')}` : ''}`}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {canImport && loaded === null && failed === null && <Loading label={t('chatJson.dialog.fetching')} lines={1} />}
      <JsonPanel
        summary={t('chat.room.json')}
        lead={canImport ? t('chatJson.dialog.leadImport') : t('chatJson.dialog.leadRead')}
        fileName={`rozmowa-${fileSlug(props.title)}-${new Date().toISOString().slice(0, 10)}.json`}
        exportDoc={exportDoc}
        format={CHAT_JSON}
        open
        preview={preview}
        importLabel={t('chatJson.dialog.importLabel')}
        onImport={onImport}
        note={canImport && props.speakerName !== null ? <>{rich(t('chatJson.dialog.note', { name: props.speakerName }), { b: (s, k) => <strong key={k}>{s}</strong> })}</> : undefined}
      />
    </Modal>
  );
}

export default ChatJsonDialog;
