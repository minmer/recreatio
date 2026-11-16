/**
 * DIE DURCHSICHT EINES KNOTENS (2026-11-16) — eine Struktur kommt oft aus einer KI. Der Autor liest sie im Gang des
 * Werks Teil für Teil und sagt je Knoten: angenommen, zu überarbeiten, zu streichen — und schreibt Notizen für die KI
 * (zum ganzen Knoten oder zu einem Akapit), als Gespräch: Antworten, erledigt, löschen. Die KI liest beides über MCP
 * (`get_work_context`, `get_work_review`) und antwortet über den Import (Notizen mit "by": "ai" kommen dazu).
 */

import { useState } from 'react';

import { newId } from '../../core/ids';
import { fmtDate, useT, type T } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { REVIEW_STATES, type EntryData } from '../../library/libraryKinds';
import { ask, toast } from '../../ui/dialogs';
import { Icon } from '../../ui/icons';
import { openNotes, patchNode, type ReviewState, type ThreadNote, type WorkNode } from './workModel';
import type { WorkCtx } from './WorkView';

/** Wie eine Notiz gespeichert steht (`para` beginnt bei 1, wie gedruckt). */
const stored = (n: ThreadNote): Record<string, unknown> => ({
  id: n.id, by: n.by, text: n.text, at: n.at,
  ...(n.reply === undefined ? {} : { reply: n.reply }),
  ...(n.para === undefined ? {} : { para: n.para + 1 }),
  ...(n.done ? { done: 'yes' } : {})
});

/** Der Stand der Durchsicht als kleines Zeichen. */
export function ReviewChip({ review, t }: { review: ReviewState; t: T }) {
  if (review === '') return <span className="review-chip is-none">{t('workUi.review.none')}</span>;
  return <span className={`review-chip is-${review}`}>{REVIEW_STATES.find((r) => r.value === review)?.label}</span>;
}

/** Speichern am Knoten — nur die genannten Felder. */
async function patch(ctx: WorkCtx, node: WorkNode, data: EntryData, t: T): Promise<boolean> {
  const entry = ctx.store.get(node.id);
  if (entry === undefined || node.virtual) return false;
  try {
    await ctx.store.save(patchNode(entry, data));
    return true;
  } catch (e) {
    toast(e instanceof WorkspaceError ? e.message : t('workUi.review.saveFailed'), { kind: 'error' });
    return false;
  }
}

export function ReviewPanel({ ctx, node, paras, para }: { ctx: WorkCtx; node: WorkNode; paras: number; para?: number }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [about, setAbout] = useState(para === undefined ? '' : String(para));
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const readOnly = ctx.readOnly || node.virtual;
  const run = async (data: EntryData) => { setBusy(true); try { return await patch(ctx, node, data, t); } finally { setBusy(false); } };

  const setReview = (value: ReviewState) => void run({ review: value === node.review ? '' : value });
  const saveThread = (list: readonly ThreadNote[]) => run({ thread: list.map(stored) });
  const add = async () => {
    const body = text.trim();
    if (body === '') return;
    const parent = replyTo === null ? undefined : node.thread.find((n) => n.id === replyTo);
    const note: ThreadNote = {
      id: `n${newId().replace(/-/g, '').slice(-8)}`, by: 'author', text: body, at: new Date().toISOString(), done: false,
      ...(parent === undefined ? {} : { reply: parent.id }),
      ...(parent?.para !== undefined ? { para: parent.para } : about === '' ? {} : { para: Number(about) })
    };
    if (await saveThread([...node.thread, note])) { setText(''); setReplyTo(null); }
  };
  const toggleDone = (note: ThreadNote) => void saveThread(node.thread.map((n) => (n.id === note.id || n.reply === note.id ? { ...n, done: !note.done } : n)));
  const remove = async (note: ThreadNote) => {
    if (!(await ask({ title: t('workUi.review.removeAsk'), confirm: t('common.delete'), danger: true }))) return;
    void saveThread(node.thread.filter((n) => n.id !== note.id && n.reply !== note.id));
  };

  const roots = node.thread.filter((n) => n.reply === undefined || !node.thread.some((x) => x.id === n.reply));
  const shown = roots.filter((n) => showDone || !n.done);
  const doneCount = roots.filter((n) => n.done).length;
  const where = (n: ThreadNote) => (n.para === undefined ? t('workUi.review.wholeNode') : t('workUi.review.para', { n: n.para + 1 }));
  const one = (n: ThreadNote, inner: boolean) => (
    <li key={n.id} className={`review-note is-${n.by}${n.done ? ' is-done' : ''}${inner ? ' is-reply' : ''}`}>
      <div className="review-note-head">
        <span className="review-note-by">{n.by === 'ai' ? t('workUi.review.byAi') : t('workUi.review.byAuthor')}</span>
        {!inner && <span className="review-note-where">{where(n)}</span>}
        {n.at !== '' && <span className="review-note-at">{fmtDate(new Date(n.at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, t.lang)}</span>}
        {n.done && <span className="review-chip is-accepted">{t('workUi.review.done')}</span>}
      </div>
      <p className="review-note-text">{n.text}</p>
      {!readOnly && (
        <div className="review-note-actions">
          {!inner && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setReplyTo(n.id); setAbout(n.para === undefined ? '' : String(n.para)); }}>{t('workUi.review.reply')}</button>}
          {!inner && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => toggleDone(n)}>{n.done ? t('workUi.review.reopen') : t('workUi.review.markDone')}</button>}
          {n.by === 'author' && <button type="button" className="wk-link-btn wk-danger-link" disabled={busy} onClick={() => void remove(n)}>{t('common.delete')}</button>}
        </div>
      )}
      {!inner && node.thread.some((x) => x.reply === n.id) && <ul className="review-thread">{node.thread.filter((x) => x.reply === n.id).map((x) => one(x, true))}</ul>}
    </li>
  );

  return (
    <div className="review-panel">
      <div className="review-states" role="group" aria-label={t('workUi.review.stateLabel')}>
        {REVIEW_STATES.map((r) => (
          <button key={r.value} type="button" disabled={readOnly || busy} aria-pressed={node.review === r.value}
            className={`review-state is-${r.value}${node.review === r.value ? ' is-on' : ''}`} onClick={() => setReview(r.value)}>
            <Icon name={r.value === 'accepted' ? 'check' : r.value === 'revise' ? 'edit' : 'x'} />{r.label}
          </button>
        ))}
        <span className="review-hint">{t(`workUi.review.hint.${node.review === '' ? 'none' : node.review}`)}</span>
      </div>
      {shown.length > 0 && <ul className="review-thread">{shown.map((n) => one(n, false))}</ul>}
      {doneCount > 0 && <button type="button" className="wk-link-btn review-done-toggle" onClick={() => setShowDone(!showDone)}>{showDone ? t('workUi.review.hideDone') : t('workUi.review.showDone', { count: doneCount })}</button>}
      {!readOnly && (
        <form className="review-compose" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          {replyTo !== null && (
            <p className="review-replying">{t('workUi.review.replying')} <button type="button" className="wk-link-btn" onClick={() => setReplyTo(null)}>{t('common.cancel')}</button></p>
          )}
          <label className="wk-field">
            <span>{replyTo === null ? t('workUi.review.newNote') : t('workUi.review.yourReply')}</span>
            <textarea rows={2} value={text} placeholder={t('workUi.review.placeholder')} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void add(); } }} />
          </label>
          <div className="review-compose-row">
            {replyTo === null && paras > 0 && (
              <label className="wk-field review-about">
                <span>{t('workUi.review.about')}</span>
                <select value={about} onChange={(e) => setAbout(e.target.value)}>
                  <option value="">{t('workUi.review.wholeNode')}</option>
                  {Array.from({ length: paras }, (_, i) => <option key={i} value={String(i)}>{t('workUi.review.para', { n: i + 1 })}</option>)}
                </select>
              </label>
            )}
            <button type="submit" className="wk-btn" disabled={busy || text.trim() === ''}>{replyTo === null ? t('workUi.review.add') : t('workUi.review.sendReply')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Die offenen Notizen zu einem Akapit — kurz unter seinem Text. */
export function ParaNotes({ node, para, t }: { node: WorkNode; para: number; t: T }) {
  const notes = openNotes(node).filter((n) => n.para === para && n.reply === undefined);
  if (notes.length === 0) return null;
  return (
    <ul className="review-para-notes">
      {notes.map((n) => <li key={n.id} className={`is-${n.by}`}><Icon name="chat" /> <span className="review-note-by">{n.by === 'ai' ? t('workUi.review.byAi') : t('workUi.review.byAuthor')}:</span> {n.text}</li>)}
    </ul>
  );
}
