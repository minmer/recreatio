/**
 * 2026-11-20 (Eigentümer) — DAS KLEINE ZEICHEN AN EINER KARTE, FRAGE, FOLIE: ein Klick öffnet die Rückmeldung — erst die Art (gut,
 * Inhalt falsch, Antwort falsch geprüft, Sprache, unklar, zu schwer, zu leicht, Darstellung, anderes), dann ein längerer Text —
 * und darunter, was zu diesem Ziel schon gesagt ist (offen, erledigt, löschen). Nur für wer in der Baza schreibt. Gelesen wird es
 * von der KI über MCP (`get_feedback`, `feedback.ts`).
 */

import { useContext, useMemo, useState } from 'react';

import { useT } from '../core/i18n';
import { FEEDBACK_KINDS, FEEDBACK_LABEL, FEEDBACK_TEXT_MAX, feedbackData, feedbackOf, sameTarget, type FeedbackKind, type FeedbackTarget } from './feedback';
import type { CogitaLibrary } from './store';
import { CogitaContext } from './ui';

export function FeedbackButton({ lib: given, target }: { lib: CogitaLibrary | null | undefined; target: FeedbackTarget }) {
  const t = useT();
  /* Die Baza, in die man schreiben darf: die gegebene, sonst die des Rahmens (ein Lauf liest oft aus einer Kopie nur zum Lesen). */
  const ctx = useContext(CogitaContext);
  const lib = given?.writes === true ? given : ctx?.lib.writes === true ? ctx.lib : null;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const here = useMemo(() => (lib == null ? [] : feedbackOf(lib).filter((f) => sameTarget(f.target, target))), [lib, target, tick, open]);
  if (lib == null || !lib.writes) return null;
  const openCount = here.filter((f) => f.state === 'open').length;
  const send = async () => {
    if (kind === null) return;
    setBusy(true);
    setFailed(null);
    try {
      await lib.saveDoc('feedback', feedbackData({ target, category: kind, text, at: new Date().toISOString(), state: 'open' }));
      setSent(true);
      setKind(null);
      setText('');
      setTick((n) => n + 1);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  const setState = async (id: string, data: Readonly<Record<string, unknown>>, state: 'open' | 'done') => {
    await lib.saveDoc('feedback', { ...data, state }, id).catch(() => undefined);
    setTick((n) => n + 1);
  };
  const remove = async (id: string) => { await lib.remove(id).catch(() => undefined); setTick((n) => n + 1); };
  return (
    <span className={`cg-fb${open ? ' is-open' : ''}`} data-feedback={target.card ?? target.entity ?? ''}>
      <button type="button" className={`cg-fb-btn${openCount > 0 ? ' has-notes' : ''}`} aria-expanded={open} onClick={() => { setOpen((v) => !v); setSent(false); }}
        title={t('cogitaFeedback.button')} aria-label={t('cogitaFeedback.button')} data-feedback-open="">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /><path d="M5 6.2h6M5 8.2h4" /></svg>
        {openCount > 0 && <span className="cg-fb-n">{openCount}</span>}
      </button>
      {open && (
        <div className="cg-fb-box" role="dialog" aria-label={t('cogitaFeedback.title')} data-feedback-box="">
          <p className="cg-fb-head"><strong>{t('cogitaFeedback.title')}</strong> <span className="cg-muted">{t('cogitaFeedback.forAi')}</span></p>
          <div className="cg-fb-kinds" role="radiogroup" aria-label={t('cogitaFeedback.kindLabel')}>
            {FEEDBACK_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`cg-fb-kind is-${k}${kind === k ? ' is-on' : ''}`} onClick={() => { setKind(k); setSent(false); }} data-feedback-kind={k}>
                {FEEDBACK_LABEL[k]}
              </button>
            ))}
          </div>
          {kind !== null && (
            <>
              <textarea rows={3} value={text} maxLength={FEEDBACK_TEXT_MAX} placeholder={t(kind === 'good' ? 'cogitaFeedback.placeholderGood' : 'cogitaFeedback.placeholder')}
                onChange={(e) => setText(e.target.value)} aria-label={t('cogitaFeedback.textLabel')} data-feedback-text="" />
              <div className="cg-fb-actions">
                <button type="button" className="wk-btn is-small" disabled={busy || (kind !== 'good' && text.trim() === '')} onClick={() => void send()} data-feedback-send="">{t('cogitaFeedback.send')}</button>
                <button type="button" className="wk-link-btn" onClick={() => { setKind(null); setText(''); }}>{t('common.cancel')}</button>
              </div>
            </>
          )}
          {sent && <p className="cg-fb-sent" role="status" data-feedback-sent="">✓ {t('cogitaFeedback.sent')}</p>}
          {failed !== null && <p className="wk-error">{failed}</p>}
          {here.length > 0 && (
            <ul className="cg-fb-list" data-feedback-list={here.length}>
              {here.map((f) => {
                const raw = lib.docs('feedback').find((d) => d.id === f.id)?.data ?? {};
                return (
                  <li key={f.id} className={f.state === 'done' ? 'is-done' : ''} data-feedback-item={f.state}>
                    <span className="cg-fb-tag">{FEEDBACK_LABEL[f.category]}</span>
                    {f.text !== '' && <span className="cg-fb-text">{f.text}</span>}
                    {/* 2026-11-22 (I6) — erledigt mit einem Import: was geändert wurde. */}
                    {f.note !== undefined && <span className="cg-fb-text cg-fb-note" data-feedback-note="">{t('cogitaFeedback.note', { note: f.note })}</span>}
                    <span className="cg-muted cg-fb-at">{f.at.slice(0, 10)}</span>
                    <span className="cg-fb-item-acts">
                      <button type="button" className="wk-link-btn" onClick={() => void setState(f.id, raw, f.state === 'open' ? 'done' : 'open')}>{f.state === 'open' ? t('cogitaFeedback.markDone') : t('cogitaFeedback.reopen')}</button>
                      <button type="button" className="wk-link-btn" onClick={() => void remove(f.id)} aria-label={t('common.delete')}>×</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
