/**
 * 0137 — ÄNDERUNGEN MIT VORSCHAU: erst die Liste dessen, was geschehen wird (`planLines`), dann
 * „Zapisz" — und danach, was geschah, mit den neuen Links (nur jetzt zu sehen). Dieselbe Stelle für
 * die Einrichtung, die Ustawienia, das JSON und das Zusammenlegen.
 */

import { useState } from 'react';

import type { Who } from '../core/session';
import { Modal } from '../ui/Modal';
import type { CommunityDoc } from './community';
import type { PlanLine } from './communityCompile';
import type { StoredCommunity } from './communityJson';
import { runCommunityImport, type RunResult } from './communityImport';

export function ResultView({ result }: { result: RunResult }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (url: string) => { void navigator.clipboard?.writeText(url).then(() => setCopied(url)); };
  return (
    <div className="wk-cm-result" data-cm-result="">
      {result.lines.map((l) => <p key={l} className="wk-note">{l}</p>)}
      {result.links.length > 0 && (
        <>
          <h3 className="wk-h3">Nowe linki — skopiuj je teraz (później: zakładka „Osoby”)</h3>
          <ul className="wk-cm-links">
            {result.links.map((l) => (
              <li key={l.url}>
                <strong>{l.name}</strong>
                <input readOnly value={l.url} aria-label={`Link: ${l.name}`} onFocus={(e) => e.target.select()} />
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => copy(l.url)}>{copied === l.url ? 'Skopiowano' : 'Kopiuj'}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {result.warnings.length > 0 && (
        <details className="wk-fold" open={result.warnings.length < 6}>
          <summary>Uwagi ({result.warnings.length})</summary>
          <ul className="wk-cm-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function PlanLines({ lines }: { lines: readonly PlanLine[] }) {
  if (lines.length === 0) return <p className="wk-note">Nic do zmiany.</p>;
  return (
    <ul className="wk-cm-plan">
      {lines.map((l, i) => <li key={i} className={`is-${l.kind}`}>{l.text}</li>)}
    </ul>
  );
}

/** Der Dialog: Plan → Zapisz → Ergebnis. */
export function RunDialog({ who, rootAreaId, doc, seed, lines, renew, title = 'Plan zmian', onClose, onDone }: {
  who: Who;
  rootAreaId: string | null;
  doc: CommunityDoc;
  seed?: Pick<StoredCommunity, 'doc' | 'state'> | null;
  lines: readonly PlanLine[];
  renew?: readonly string[];
  title?: string;
  onClose: () => void;
  onDone: (result: RunResult) => void;
}) {
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const go = async () => {
    setFailed(null);
    setStage('Start…');
    try {
      const r = await runCommunityImport({ who, rootAreaId, doc, seed: seed ?? null, renew, stage: setStage });
      setResult(r);
      onDone(r);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setStage(null);
    }
  };
  return (
    <Modal title={title} onClose={() => { if (stage === null) onClose(); }} wide>
      {result === null ? (
        <>
          <PlanLines lines={lines} />
          <p className="wk-note">Nowe role i linki to kilkanaście sekund liczenia kluczy w tej przeglądarce każdy — nie zamykaj karty.</p>
          {failed && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={stage !== null} onClick={() => void go()} data-cm-run="">{stage ?? 'Zapisz zmiany'}</button>
            <button type="button" className="wk-btn wk-btn-line" disabled={stage !== null} onClick={onClose}>Anuluj</button>
          </div>
        </>
      ) : (
        <>
          <ResultView result={result} />
          <div className="wk-actions"><button type="button" className="wk-btn" onClick={onClose}>Gotowe</button></div>
        </>
      )}
    </Modal>
  );
}
