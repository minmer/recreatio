/**
 * Das Protokoll, ansehbar — und nachrechenbar.
 *
 * Der Punkt dieser Ansicht ist nicht die Liste. Es ist der Knopf daneben.
 *
 * Der Dienst hat einen eigenen Prüfweg, und der ist ausdrücklich NICHT das,
 * worauf man sich verlassen soll: er ist die Aussage desselben, der die Daten
 * hält. „Ich habe nachgesehen, es stimmt alles" aus dem Mund des Betreibers
 * ist genau die Zusicherung, ohne die ein solches Protokoll auskommen soll —
 * denn der Betreiber ist derjenige, gegen den es schützt.
 *
 * Also rechnet dieser Browser die Kette selbst nach und stellt beide Antworten
 * nebeneinander. Wenn sie auseinandergehen, ist DAS der Fund, und die Ansicht
 * sagt das mit so vielen Worten.
 */

import { useCallback, useEffect, useState } from 'react';
import { rcCopy, rcFormat, rcPlural, type RcLang } from './i18n';
import type { RcRole } from './lib/rcChat';
import {
  rcAgrees, rcCreateDecision, rcDecisions, rcLedgerEntries, rcLedgerVerdict, rcRecompute,
  rcTransition, type RcChainCheck, type RcDecision, type RcLedgerEntry, type RcLedgerVerdict
} from './lib/rcLedger';
import { useRcError } from './RcThreads';

export function RcLedger({
  lang, ledgerId, onError
}: {
  lang: RcLang;
  ledgerId: string;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].ledger;
  const describe = useRcError(lang);

  const [entries, setEntries] = useState<readonly RcLedgerEntry[]>([]);
  const [mine, setMine] = useState<RcChainCheck | null>(null);
  const [theirs, setTheirs] = useState<RcLedgerVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setEntries((await rcLedgerEntries(ledgerId)).entries ?? []); }
    catch (e) { onError(describe(e)); }
  }, [ledgerId, describe, onError]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Beides holen und beides zeigen. Erst die eigene Rechnung, dann die Auskunft
   * des Dienstes — in dieser Reihenfolge, weil die eigene die ist, die zählt.
   */
  const check = async () => {
    setBusy(true);
    try {
      const fresh = (await rcLedgerEntries(ledgerId)).entries ?? [];
      setEntries(fresh);
      setMine(rcRecompute(fresh));
      setTheirs(await rcLedgerVerdict(ledgerId));
    } catch (e) {
      onError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const disagreement = mine !== null && theirs !== null && !rcAgrees(mine, theirs);

  return (
    <div className="rc-panel">
      <p className="rc-note">{t.intro}</p>

      <button type="button" className="rc-btn" disabled={busy} onClick={() => void check()}>
        {busy ? t.checking : t.check}
      </button>

      {mine !== null && (
        <div className="rc-verdict" data-state={disagreement ? 'disagree' : mine.intact ? 'ok' : 'broken'}>
          {disagreement ? (
            <>
              <strong>{t.disagree}</strong>
              <p>{t.disagreeWhy}</p>
            </>
          ) : mine.intact ? (
            <>
              <strong>{t.intact}</strong>
              <p>{t.intactWhy}</p>
            </>
          ) : (
            <>
              <strong>{t.broken}</strong>
              <p>{rcFormat(t.brokenAt, { n: mine.firstBrokenSequence ?? 0 })}</p>
              {mine.reason !== null && <p>{t.reasons[mine.reason] ?? mine.reason}</p>}
            </>
          )}

          <p className="rc-verdict-count">{rcPlural(lang, t.entries, mine.checked)}</p>

          {/* Die Grenze der eigenen Prüfung steht dabei. Eine Prüfung, die
              mehr zu können vorgibt, als sie kann, ist schlimmer als keine —
              sie erzeugt ein Vertrauen, das sie nicht deckt. */}
          <p className="rc-verdict-limits">{t.limits}</p>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="rc-note">{t.empty}</p>
      ) : (
        <ol className="rc-chain">
          {entries.map((entry) => (
            <li
              key={entry.entryId}
              className="rc-link-row"
              data-broken={mine?.firstBrokenSequence === entry.sequence}
            >
              <div className="rc-link-head">
                <span className="rc-link-seq">{t.sequence} {entry.sequence}</span>
                <span className="rc-link-mod">{entry.moduleId}</span>
                <time dateTime={entry.serverTimestamp}>
                  {new Date(entry.serverTimestamp).toLocaleString(lang)}
                </time>
              </div>

              {/* Die beiden Hashes untereinander: so sieht man, dass der obere
                  eines Eintrags der untere des vorigen ist. Genau darauf
                  beruht die ganze Sache, und sie soll sichtbar sein. */}
              <dl className="rc-link-hashes">
                <dt>{t.previous}</dt>
                <dd><code>{entry.previousHash}</code></dd>
                <dt>{t.hash}</dt>
                <dd><code>{entry.entryHash}</code></dd>
              </dl>

              <details className="rc-link-payload">
                <summary>{t.payload}</summary>
                <pre>{entry.payloadCanonical}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// -- Kapitel 11: Beschlüsse ---------------------------------------------------

export function RcDecisions({
  lang, areaId, role, onError
}: {
  lang: RcLang;
  areaId: string;
  role: RcRole | undefined;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].ledger;
  const describe = useRcError(lang);

  const [decisions, setDecisions] = useState<readonly RcDecision[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setDecisions((await rcDecisions(areaId)).decisions ?? []); }
    catch (e) { onError(describe(e)); }
  }, [areaId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="rc-panel">
      {decisions.length === 0 && <p className="rc-note">{t.noDecisions}</p>}

      {decisions.map((decision) => (
        <RcDecisionCard
          key={decision.decisionId}
          lang={lang}
          decision={decision}
          role={role}
          onChanged={refresh}
          onError={onError}
        />
      ))}

      {role && (
        <form
          className="rc-new-decision"
          onSubmit={async (e) => {
            e.preventDefault();
            if (body.trim().length === 0 || busy) return;
            setBusy(true);
            try { await rcCreateDecision(areaId, role.roleId, body); setBody(''); await refresh(); }
            catch (err) { onError(describe(err)); }
            finally { setBusy(false); }
          }}
        >
          <label className="rc-field">
            <span>{t.newDecision}</span>
            <textarea
              value={body}
              rows={2}
              placeholder={t.decisionBody}
              disabled={busy}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button type="submit" className="rc-btn" disabled={busy || body.trim().length === 0}>
            {t.propose}
          </button>
        </form>
      )}
    </div>
  );
}

function RcDecisionCard({
  lang, decision, role, onChanged, onError
}: {
  lang: RcLang;
  decision: RcDecision;
  role: RcRole | undefined;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].ledger;
  const describe = useRcError(lang);

  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const name = (state: string) => t.states[state] ?? state;

  return (
    <article className="rc-decision" data-state={decision.state}>
      <header className="rc-decision-head">
        <span className="rc-decision-state">{name(decision.state)}</span>
        <time dateTime={decision.createdAt}>{new Date(decision.createdAt).toLocaleDateString(lang)}</time>
      </header>

      <p className="rc-decision-body">{decision.body}</p>

      {decision.history.length > 0 && (
        <details className="rc-decision-history">
          <summary>{t.history}</summary>
          <ol>
            {decision.history.map((step, i) => (
              <li key={i}>
                <span className="rc-step">{name(step.fromState)} → {name(step.toState)}</span>
                {/* Die Begründung ist der Grund, warum es diese Liste gibt.
                    Ohne sie stünde da eine Folge von Zuständen und niemand
                    wüsste mehr, warum. */}
                {step.reason !== null && step.reason !== undefined && (
                  <span className="rc-step-why">{step.reason}</span>
                )}
                <time dateTime={step.at}>{new Date(step.at).toLocaleDateString(lang)}</time>
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* Was von hier aus offen steht, sagt der Dienst — nicht diese Datei.
          Stünde die Tafel hier noch einmal, liefe sie irgendwann von der
          echten weg und böte Wege an, die abgewiesen werden. */}
      {decision.allowedNext.length === 0 ? (
        <p className="rc-note rc-decision-final">{t.finalState}</p>
      ) : role ? (
        <div className="rc-decision-move">
          <div className="rc-decision-targets">
            {decision.allowedNext.map((state) => (
              <button
                key={state}
                type="button"
                className="rc-btn rc-btn-quiet"
                aria-pressed={target === state}
                onClick={() => setTarget(target === state ? null : state)}
              >
                {rcFormat(t.move, { state: name(state) })}
              </button>
            ))}
          </div>

          {/* Der Grund wird VOR dem Wechsel verlangt, nicht danach als
              Pflichtfeld, das man mit einem Punkt füllt. */}
          {target !== null && (
            <form
              className="rc-decision-reason"
              onSubmit={async (e) => {
                e.preventDefault();
                if (reason.trim().length === 0 || busy) return;
                setBusy(true);
                try {
                  await rcTransition(decision.decisionId, role.roleId, target, reason);
                  setReason('');
                  setTarget(null);
                  await onChanged();
                } catch (err) {
                  onError(describe(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="rc-field">
                <span>{t.reason}</span>
                <textarea
                  value={reason}
                  rows={2}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <p className="rc-note rc-reason-why">{t.reasonWhy}</p>
              <button type="submit" className="rc-btn" disabled={busy || reason.trim().length === 0}>
                {rcFormat(t.move, { state: name(target) })}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </article>
  );
}
