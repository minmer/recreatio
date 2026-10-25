/**
 * 0130 — DIE MELDUNG: warum, was, wie erreichbar (freiwillig) — versiegelt für den
 * Betreiber, bevor sie den Browser verlässt (`reports.ts`). Danach die Quittung:
 * nur mit ihr sieht man, was aus der Meldung wurde; sie steht nirgends sonst.
 *
 * Steht auf `#/zglos` (`ReportPage`) und im Fenster an einer Nachricht (`ReportDialog`).
 */

import { useRef, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { operatorLine } from '../operator';
import { reportStatusPath, type ReportKind } from './reportPath';
import { KIND_WORDS, REASONS, sendReport, type ReportReason, type Sent } from './reports';

/** Was gemeldet wird — und, wo es geht, was der Meldende davon sieht. */
export interface ReportWhat {
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly itemAt?: number | null;
  readonly path?: string | null;
  readonly title?: string | null;
  /** Was der Meldende sieht (eine Nachricht): der Betreiber hat dazu keinen Schlüssel. */
  readonly quote?: string | null;
}

/** „Strona „Ogłoszenia" (recreatio.pl/parafia/ogloszenia)" — damit klar ist, worum es geht. */
export function whatText(what: Pick<ReportWhat, 'itemKind' | 'title' | 'path'>): string {
  const title = (what.title ?? '').trim();
  const path = (what.path ?? '').trim();
  return `${KIND_WORDS[what.itemKind]}${title === '' ? '' : ` „${title}”`}${path === '' ? '' : ` (recreatio.pl/${path})`}`;
}

const say = (e: unknown, fallback: string) => (e instanceof WorkspaceError || (e instanceof Error && e.message !== '') ? e.message : fallback);

export function ReportForm({ what, onDone }: {
  what: ReportWhat;
  /** Nach dem Senden: „Zamknij" neben der Quittung (im Fenster). */
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const offered = (what.quote ?? '').trim();
  const [quote, setQuote] = useState(offered);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  if (sent !== null) return <Receipt sent={sent} onDone={onDone} />;

  const ready = reason !== null && text.trim().length >= 3 && !busy;

  const go = async () => {
    if (reason === null) return;
    setBusy(true);
    setFailed(null);
    try {
      setSent(await sendReport({
        itemKind: what.itemKind, itemId: what.itemId, itemAt: what.itemAt ?? null, path: what.path ?? null, title: what.title ?? null,
        reason, text, contact, quote
      }));
    } catch (e) {
      setFailed(say(e, 'Nie udało się wysłać zgłoszenia.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-form wk-report-form" data-report-form={what.itemKind} onSubmit={(e) => { e.preventDefault(); if (ready) void go(); }}>
      <p className="wk-report-what">Zgłaszasz: <strong>{whatText(what)}</strong></p>

      <fieldset className="ui-choices" disabled={busy}>
        <legend className="wk-report-legend">Czego dotyczy zgłoszenie?</legend>
        {REASONS.map((one) => (
          <label key={one.value} className="ui-choice" data-reason={one.value}>
            <input type="radio" name="report-reason" checked={reason === one.value} onChange={() => setReason(one.value)} />
            <span className="ui-choice-title">{one.label}</span>
            <span className="ui-choice-text">{one.says}</span>
          </label>
        ))}
      </fieldset>

      <label className="wk-field">
        <span>Co jest nie tak?</span>
        <textarea rows={4} maxLength={5000} value={text} disabled={busy} data-report-text=""
          placeholder="Krótko: czego dotyczy i dlaczego ta treść nie powinna tu być."
          onChange={(e) => setText(e.target.value)} />
      </label>

      {offered !== '' && (
        <div className="wk-field wk-report-quote">
          <span>To, co widzisz</span>
          {quote !== '' ? (
            <>
              <textarea rows={3} maxLength={10000} value={quote} disabled={busy} data-report-quote="" onChange={(e) => setQuote(e.target.value)} />
              <p className="wk-report-small">
                Operator nie ma klucza do tej treści — dostanie tylko to, co tu zostawisz.{' '}
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setQuote('')}>Nie dołączaj</button>
              </p>
            </>
          ) : (
            <p className="wk-report-small">
              Treść nie zostanie dołączona.{' '}
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setQuote(offered)}>Dołącz jednak</button>
            </p>
          )}
        </div>
      )}

      <label className="wk-field">
        <span>Jak możemy się z Tobą skontaktować (nieobowiązkowo)</span>
        <input type="text" maxLength={300} value={contact} disabled={busy} autoComplete="email" data-report-contact=""
          placeholder="e-mail albo telefon" onChange={(e) => setContact(e.target.value)} />
      </label>

      <p className="wk-report-small">
        Zgłoszenie trafi zaszyfrowane do operatora serwisu: {operatorLine()}. Nie zapisujemy, kto zgłasza — operator dowie się
        o Tobie tylko tego, co sam tu wpiszesz.
      </p>

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={!ready} data-report-send="">{busy ? 'Szyfrowanie i wysyłanie…' : 'Wyślij zgłoszenie'}</button>
        {onDone !== undefined && <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onDone}>Anuluj</button>}
      </div>
    </form>
  );
}

/** Die Quittung — gross, zum Kopieren, mit dem Weg zum Stand der Meldung. */
export function Receipt({ sent, onDone }: { sent: Sent; onDone?: () => void }) {
  const code = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState<'yes' | 'select' | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sent.receipt);
      setCopied('yes');
    } catch {
      /* Ohne Zwischenablage: markiert, zum Kopieren von Hand. */
      const el = code.current;
      const selection = window.getSelection();
      if (el !== null && selection !== null) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopied('select');
    }
  };

  return (
    <div className="wk-report-sent" data-report-sent="">
      <p className="wk-done" role="status">Zgłoszenie wysłane.</p>
      <p>Zachowaj ten kod — tylko z nim sprawdzisz, co stało się ze zgłoszeniem:</p>
      <div className="wk-report-receipt">
        <code ref={code} data-report-receipt="">{sent.receipt}</code>
        <button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => void copy()}>Kopiuj</button>
      </div>
      {copied === 'yes' && <p className="wk-done">Skopiowano.</p>}
      {copied === 'select' && <p className="wk-report-small">Kod jest zaznaczony — skopiuj go (Ctrl+C).</p>}
      <div className="wk-actions">
        <a className="wk-link" href={reportStatusPath()}>Sprawdź stan zgłoszenia</a>
        {onDone !== undefined && <button type="button" className="wk-btn wk-btn-quiet" onClick={onDone}>Zamknij</button>}
      </div>
    </div>
  );
}

export default ReportForm;
