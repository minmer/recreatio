/**
 * PRZENIESIENIE DANYCH — `#/workspace/account/przeniesienie`.
 *
 * Was nach Schritt 3 noch übrig ist (`transfer.ts`): Antworten in RSA-Umschlägen,
 * die DIESER Browser mit DIESEM Konto umstellen kann, und was der Server noch
 * aufzuräumen hat. Steht alles auf null, geht die Seite (documentation/TRANSFER.md).
 */

import { useCallback, useEffect, useState } from 'react';

import type { Ring } from '../core/keys';
import { useT } from '../core/i18n';
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
  const t = useT();
  useCrumbs([{ label: t('account.page.transfer'), href: null }]);

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
    return <div className="wk-narrow ui-page"><p className="wk-error">{t('account.transfer.loadFailed')}</p></div>;
  }

  const { status, ring } = loaded;
  const mine = status.rsaForms.reduce((n, f) => n + f.values, 0);

  const rewrap = async () => {
    if (ring === null) return;
    setBusy(true);
    setSaid(null);
    try {
      const done = await rewrapForms(ring, status.rsaForms);
      setSaid(done.failed > 0
        ? t('account.transfer.rewrappedFailed', { count: done.rewrapped, failed: t('account.transfer.formsFailed', { count: done.failed }) })
        : t('account.transfer.rewrapped', { count: done.rewrapped }));
    } catch (e) {
      setSaid(e instanceof WorkspaceError ? e.message : t('account.transfer.rewrapFailed'));
    } finally {
      setBusy(false);
      invalidate();
      await look();
    }
  };

  return (
    <div className="wk-narrow ui-page wk-transfer">
      <PageHeader
        title={t('account.page.transfer')}
        meta={status.rsa === 0 ? t('account.transfer.allCurrent') : t('account.transfer.rsaTotal', { count: status.rsa })}
      />

      <p className="wk-lede">{t('account.transfer.lead')}</p>

      {ring === null && status.rsaForms.length > 0 && (
        <Unlock who={who} why={t('account.transfer.unlockWhy')} onDone={() => void look()} />
      )}

      {said !== null && <p className="wk-done" role="status">{said}</p>}

      <section className="wk-box" aria-label={t('account.transfer.toMove')}>
        <div className="wk-line is-wrap wk-line-first">
          <span className={`wk-line-ic ${status.rsaForms.length === 0 ? 'is-ok' : 'is-warn'}`}>
            <Icon name={status.rsaForms.length === 0 ? 'check' : 'lock'} />
          </span>
          <span className="wk-line-text">
            <span className="wk-line-title">{t('account.transfer.rsaTitle')}</span>
            <span className="wk-line-sub">
              {status.rsaForms.length === 0
                ? (status.rsa === 0 ? t('account.transfer.allOffice') : t('account.transfer.othersForms'))
                : t('account.transfer.mine', { answers: t('account.transfer.answers', { count: mine }), forms: t('account.transfer.inForms', { count: status.rsaForms.length }) })}
            </span>
          </span>
          {ring !== null && status.rsaForms.length > 0 && (
            <span className="wk-line-end">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => void rewrap()}>
                {busy ? t('account.transfer.rewrapping') : t('account.transfer.rewrap')}
              </button>
            </span>
          )}
        </div>
      </section>

      <section aria-labelledby="transfer-server">
        <h2 className="wk-h2" id="transfer-server">{t('account.transfer.server')}</h2>
        <ul className="wk-list">
          <Count n={status.migrations.length} label={status.migrations.length > 0 ? t('account.transfer.migrationsRange', { from: status.migrations[0], to: status.migrations[status.migrations.length - 1] }) : t('account.transfer.migrations')} />
          <Count n={status.legacySchemas.length} label={status.legacySchemas.length > 0 ? t('account.transfer.legacyList', { list: status.legacySchemas.join(', ') }) : t('account.transfer.legacy')} />
          <Count n={status.unheld} label={t('account.transfer.unheld')} />
        </ul>
        <p>{t('account.transfer.adminNote')}</p>
      </section>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  const t = useT();
  return (
    <li className="wk-row">
      <span><strong>{n}</strong> {label}</span>
      {n === 0 && <span className="wk-tag">{t('account.transfer.ready')}</span>}
    </li>
  );
}
