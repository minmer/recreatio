/**
 * 0130 — ZGŁOŚ TREŚĆ, ohne Konto:
 *
 * <code>
 *   #/zglos                    eine Adresse eingeben, dann: die Seite oder einer ihrer Teile/Dateien
 *   #/zglos/<art>/<kennung>    eine Sache (aus der Fusszeile einer Seite, einem Widget, einer Klausel)
 *   #/zglos/stan               was aus einer Meldung wurde — mit der Quittung
 * </code>
 *
 * Melden kann jeder, was er lesen kann: der Dienst prüft es an der Kennung (mit der
 * Sitzung oder den Links dieses Browsers), bevor er die Meldung annimmt.
 */

import { useEffect, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { operatorLine } from '../operator';
import { partLabel } from '../pages/parts/registry';
import { pagePath } from '../routes';
import { Loading } from '../ui/Loading';
import { isReportKind, reportAnyPath, reportStatusPath, type ReportKind } from './reportPath';
import { KIND_WORDS, reportStatus, STATE_WORDS, targetOf, targetOfAddress, type ReportStatus, type ReportTarget } from './reports';
import { ReportForm, whatText, type ReportWhat } from './ReportForm';

const said = (e: unknown, fallback: string) => (e instanceof WorkspaceError ? e.message : fallback);

const day = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ReportPage({ slug, tail }: { slug: string | null; tail: readonly string[] }) {
  return (
    <div className="wk-report-page" data-report-page={slug ?? ''}>
      <h1 className="wk-h1">{slug === 'stan' ? 'Stan zgłoszenia' : 'Zgłoś treść'}</h1>
      {slug === 'stan' ? <StatusCheck />
        : isReportKind(slug) && (tail[0] ?? '') !== '' ? <ReportOne kind={slug} id={tail[0]} />
        : <ReportAddress />}
    </div>
  );
}

/** Wohin es geht — einmal oben, damit niemand rät. */
function Lede() {
  return (
    <p className="wk-lede">
      Zgłoszenie trafia do operatora serwisu ({operatorLine()}), który decyduje, czy treść zablokować. Zgłosić możesz to, co widzisz.
    </p>
  );
}

/* -- Eine Sache, schon benannt --------------------------------------------------------- */

function ReportOne({ kind, id }: { kind: ReportKind; id: string }) {
  const [target, setTarget] = useState<ReportTarget | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setTarget(undefined);
    setFailed(null);
    void (async () => {
      try {
        const found = await targetOf(kind, id);
        /* Eine Seite: auch ihre Teile und Dateien zur Wahl — die Fusszeile meldet sonst immer die ganze Seite. */
        const withParts = found.itemKind === 'page' && found.path !== null
          ? await targetOfAddress(found.path).catch(() => found)
          : found;
        if (alive) setTarget(withParts.itemId === found.itemId ? withParts : found);
      } catch (e) {
        if (!alive) return;
        setTarget(null);
        setFailed(said(e, 'Nie udało się sprawdzić, co zgłaszasz.'));
      }
    })();
    return () => { alive = false; };
  }, [kind, id]);

  if (target === undefined) return <Loading label="Sprawdzanie…" lines={2} />;
  if (target === null) {
    return (
      <>
        <p className="wk-error" role="alert">{failed}</p>
        <p><a className="wk-link" href={reportAnyPath()}>Podaj adres strony, którą chcesz zgłosić</a></p>
      </>
    );
  }
  return (
    <>
      <Lede />
      <Choose target={target} />
    </>
  );
}

/* -- Eine Adresse ---------------------------------------------------------------------- */

function ReportAddress() {
  const [address, setAddress] = useState('');
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const look = async () => {
    setBusy(true);
    setFailed(null);
    try {
      setTarget(await targetOfAddress(address.trim()));
    } catch (e) {
      setFailed(said(e, 'Nie udało się znaleźć tej strony.'));
    } finally {
      setBusy(false);
    }
  };

  if (target !== null) {
    return (
      <>
        <Lede />
        <Choose target={target} />
        <p><button type="button" className="wk-link-btn" onClick={() => setTarget(null)}>Inny adres</button></p>
      </>
    );
  }

  return (
    <>
      <Lede />
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (address.trim() !== '' && !busy) void look(); }}>
        <label className="wk-field">
          <span>Adres strony</span>
          <input type="text" value={address} disabled={busy} placeholder="np. recreatio.pl/#/parafia/ogloszenia" data-report-address=""
            onChange={(e) => setAddress(e.target.value)} />
        </label>
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || address.trim() === ''}>{busy ? 'Szukanie…' : 'Dalej'}</button>
          <a className="wk-link" href={reportStatusPath()}>Mam kod zgłoszenia — sprawdź stan</a>
        </div>
      </form>
    </>
  );
}

/* -- Was genau: die Seite, ein Teil, eine Datei ------------------------------------------ */

interface Option { readonly key: string; readonly what: ReportWhat; readonly label: string; readonly show: string | null }

function optionsOf(target: ReportTarget): readonly Option[] {
  const page: ReportWhat = { itemKind: target.itemKind, itemId: target.itemId, path: target.path, title: target.title };
  if (target.itemKind !== 'page' || target.parts.length === 0) return [{ key: target.itemId, what: page, label: whatText(page), show: null }];

  /* Dieselbe Art zweimal: mit ihrer Stelle, sonst wüsste niemand, welcher Text gemeint ist. */
  const seen = new Map<string, number>();
  const counted = target.parts.map((part) => {
    const word = part.itemKind === 'file' ? (part.name ?? part.kind) : partLabel(part.kind);
    const n = (seen.get(word) ?? 0) + 1;
    seen.set(word, n);
    return { part, word, n };
  });
  const total = new Map<string, number>();
  for (const one of counted) total.set(one.word, Math.max(total.get(one.word) ?? 0, one.n));

  return [
    { key: target.itemId, what: page, label: `Całą stronę${target.title === null ? '' : ` „${target.title}”`}`, show: null },
    ...counted.map(({ part, word, n }) => ({
      key: part.itemId,
      what: { itemKind: part.itemKind, itemId: part.itemId, path: target.path, title: target.title } as ReportWhat,
      label: part.itemKind === 'file'
        ? `Plik: ${word}`
        : `Moduł: ${word}${(total.get(word) ?? 1) > 1 ? ` (${n}.)` : ''}`,
      show: part.itemKind === 'part' && target.path !== null ? `${pagePath(target.path)}?part=${encodeURIComponent(part.itemId)}` : null
    }))
  ];
}

function Choose({ target }: { target: ReportTarget }) {
  const options = optionsOf(target);
  const [chosen, setChosen] = useState<string | null>(options.length === 1 ? options[0].key : null);
  const [going, setGoing] = useState(false);
  const picked = options.find((one) => one.key === chosen) ?? null;

  if (going && picked !== null) {
    return (
      <>
        <ReportForm what={picked.what} />
        <p><button type="button" className="wk-link-btn" onClick={() => setGoing(false)}>Wybierz coś innego</button></p>
      </>
    );
  }
  if (options.length === 1) return <ReportForm what={options[0].what} />;

  return (
    <div className="wk-form">
      <fieldset className="ui-choices">
        <legend className="wk-report-legend">Co dokładnie zgłaszasz?</legend>
        {options.map((one) => (
          <label key={one.key} className="ui-choice" data-report-option={one.what.itemKind}>
            <input type="radio" name="report-target" checked={chosen === one.key} onChange={() => setChosen(one.key)} />
            <span className="ui-choice-title">{one.label}</span>
            {one.show !== null && (
              <span className="ui-choice-text">
                <a className="wk-link" href={one.show} target="_blank" rel="noopener noreferrer">pokaż na stronie</a>
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={picked === null} onClick={() => setGoing(true)}>Dalej</button>
      </div>
    </div>
  );
}

/* -- Was aus einer Meldung wurde -------------------------------------------------------- */

function StatusCheck() {
  const [receipt, setReceipt] = useState('');
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const look = async () => {
    setBusy(true);
    setFailed(null);
    setStatus(null);
    try {
      setStatus(await reportStatus(receipt));
    } catch (e) {
      setFailed(said(e, 'Nie udało się sprawdzić.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="wk-lede">Wpisz kod, który dostałeś po wysłaniu zgłoszenia.</p>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (receipt.trim() !== '' && !busy) void look(); }}>
        <label className="wk-field">
          <span>Kod zgłoszenia</span>
          <input type="text" className="wk-report-code" value={receipt} disabled={busy} autoComplete="off" spellCheck={false} data-report-receipt-input=""
            onChange={(e) => setReceipt(e.target.value)} />
        </label>
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || receipt.trim() === ''}>{busy ? 'Sprawdzanie…' : 'Sprawdź'}</button>
        </div>
      </form>

      {status !== null && (
        <dl className="wk-report-status" data-report-state={status.state}>
          <div><dt>Co</dt><dd>{KIND_WORDS[status.itemKind] ?? status.itemKind}</dd></div>
          <div><dt>Stan</dt><dd><strong>{STATE_WORDS[status.state] ?? status.state}</strong></dd></div>
          <div><dt>Wysłane</dt><dd>{day(status.receivedAt)}</dd></div>
          {status.decidedAt !== null && <div><dt>Decyzja</dt><dd>{day(status.decidedAt)}</dd></div>}
        </dl>
      )}

      <p><a className="wk-link" href={reportAnyPath()}>Zgłoś inną treść</a></p>
    </>
  );
}

export default ReportPage;
