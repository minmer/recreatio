/**
 * PRZENIESIENIE DANYCH — `#/workspace/account/przeniesienie`.
 *
 * Was nach Schritt 3 noch übrig ist (`transfer.ts`): Antworten in RSA-Umschlägen,
 * die DIESER Browser mit DIESEM Konto umstellen kann, und was der Server noch
 * aufzuräumen hat. Steht alles auf null, geht die Seite (documentation/TRANSFER.md).
 */

import { useCallback, useEffect, useState } from 'react';

import type { Ring } from '../core/keys';
import { plural } from '../core/plural';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { useCrumbs } from '../shell/crumbTrail';
import { Unlock } from '../shell/Unlock';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { invalidate } from '../workspace/viewData';
import { loadTransfer, rewrapForms, type TransferStatus } from './transfer';

/** Die Adresse dieser Seite unter dem Konto. */
export const TRANSFER = 'przeniesienie';

interface Loaded {
  readonly status: TransferStatus;
  readonly ring: Ring | null;
}

export function TransferPage({ who }: { who: Who }) {
  useCrumbs([{ label: 'Przeniesienie danych', href: null }]);

  const [loaded, setLoaded] = useState<Loaded | null | 'failed'>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const [status, keys] = await Promise.all([loadTransfer(), keysFor(who)]);
      setLoaded({ status, ring: keys.ring });
    } catch {
      setLoaded('failed');
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  if (loaded === null) return <div className="wk-narrow ui-page"><Loading lines={4} /></div>;
  if (loaded === 'failed') {
    return <div className="wk-narrow ui-page"><p className="wk-error">Nie udało się wczytać stanu przeniesienia.</p></div>;
  }

  const { status, ring } = loaded;
  const mine = status.rsaForms.reduce((n, f) => n + f.values, 0);

  const rewrap = async () => {
    if (ring === null) return;
    setBusy(true);
    setSaid(null);
    try {
      const done = await rewrapForms(ring, status.rsaForms);
      setSaid(`Przepakowano ${done.rewrapped} ${plural(done.rewrapped, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} z koperty RSA`
        + (done.failed > 0 ? `; ${done.failed} ${plural(done.failed, 'formularz się nie otworzył', 'formularze się nie otworzyły', 'formularzy się nie otworzyło')}.` : '.'));
    } catch (e) {
      setSaid(e instanceof WorkspaceError ? e.message : 'Nie udało się przepakować.');
    } finally {
      setBusy(false);
      invalidate();
      await look();
    }
  };

  return (
    <div className="wk-narrow ui-page wk-transfer">
      <PageHeader
        title="Przeniesienie danych"
        meta={status.rsa === 0 ? 'Wszystko jest już w obecnej postaci.' : `Odpowiedzi w kopertach RSA w całej bazie: ${status.rsa}`}
      />

      <p className="wk-lede">
        Platforma przeszła na obecną postać danych. Zostały odpowiedzi, które leżą jeszcze w kopertach RSA pod kluczem
        innego obszaru — przepakowuje je ta przeglądarka, pod klucz kancelarii. Nic nie zmienia tego, kto co widzi.
      </p>

      {ring === null && status.rsaForms.length > 0 && (
        <Unlock who={who} why="Odpowiedzi przepakowuje ta przeglądarka — potrzebne jest hasło." onDone={() => void look()} />
      )}

      {said !== null && <p className="wk-done" role="status">{said}</p>}

      <section className="wk-box" aria-label="Do przeniesienia">
        <div className="wk-line is-wrap wk-line-first">
          <span className={`wk-line-ic ${status.rsaForms.length === 0 ? 'is-ok' : 'is-warn'}`}>
            <Icon name={status.rsaForms.length === 0 ? 'check' : 'lock'} />
          </span>
          <span className="wk-line-text">
            <span className="wk-line-title">Odpowiedzi w kopertach RSA</span>
            <span className="wk-line-sub">
              {status.rsaForms.length === 0
                ? (status.rsa === 0 ? 'Wszystkie odpowiedzi leżą pod kluczem kancelarii.' : 'Pozostałe należą do formularzy, których nie prowadzisz.')
                : `${mine} ${plural(mine, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} w ${status.rsaForms.length} ${plural(status.rsaForms.length, 'formularzu', 'formularzach', 'formularzach')} — zostaną przepakowane pod klucz kancelarii.`}
            </span>
          </span>
          {ring !== null && status.rsaForms.length > 0 && (
            <span className="wk-line-end">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => void rewrap()}>
                {busy ? 'Przepakowywanie…' : 'Przepakuj'}
              </button>
            </span>
          )}
        </div>
      </section>

      <section aria-labelledby="transfer-server">
        <h2 className="wk-h2" id="transfer-server">Po stronie serwera</h2>
        <ul className="wk-list">
          <Count n={status.migrations.length} label={`skrypty bazy bez wpisu${status.migrations.length > 0 ? ` (${status.migrations[0]} … ${status.migrations[status.migrations.length - 1]})` : ''}`} />
          <Count n={status.legacySchemas.length} label={`puste schematy starego systemu${status.legacySchemas.length > 0 ? `: ${status.legacySchemas.join(', ')}` : ''}`} />
          <Count n={status.unheld} label="role, których nikt już nie trzyma" />
        </ul>
        <p>To porządkuje administrator serwera — opis w documentation/TRANSFER.md.</p>
      </section>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <li className="wk-row">
      <span><strong>{n}</strong> {label}</span>
      {n === 0 && <span className="wk-tag">gotowe</span>}
    </li>
  );
}
