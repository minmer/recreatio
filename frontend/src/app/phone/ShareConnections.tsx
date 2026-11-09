/**
 * THUNDERBIRD (0125) — Połączenia: Programme, die grosse Anhänge als Pliki przez
 * link ablegen (der Dodatek `frontend/thunderbird`). „Połącz Thunderbirda" macht
 * den Kod połączenia und zeigt ihn EINMAL; die Liste sagt, was verbunden ist, wann
 * es zuletzt etwas schickte und was es gerade teilt — und trennt.
 *
 * Unter „Pliki przez link" (`Shares.tsx`), auf dem Telefon und im Browser.
 */

import { useCallback, useEffect, useState } from 'react';

import { fmtDate, rich, useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import type { PhoneCtx } from './phoneContext';
import { connectDevice, disconnectDevice, loadDevices, type ShareDevice } from './share';
import { sizeText } from './shareSeal';

const day = (at: string) => fmtDate(new Date(at), { day: 'numeric', month: 'short', year: 'numeric' });

/** Wo die Seite den Dodatek anbietet (`npm run thunderbird:xpi` legt ihn nach public/). */
const ADDON = '/thunderbird/recreatio-filelink.xpi';

export function ShareConnections({ ctx, onChanged }: { ctx: PhoneCtx; onChanged: () => void }) {
  const t = useT();
  /* `old`: ein Dienst vor 0125 — dann gibt es hier noch nichts zu verbinden. */
  const [devices, setDevices] = useState<readonly ShareDevice[] | 'old' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices((await loadDevices(ctx)) ?? 'old');
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('phoneShare.conn.loadFailed'));
    }
  }, [ctx, t]);
  useEffect(() => { void load(); }, [load]);

  const drop = async (device: ShareDevice) => {
    const yes = await ask({
      title: device.name === null ? t('phoneShare.conn.dropAskThis') : t('phoneShare.conn.dropAsk', { name: device.name }),
      body: t('phoneShare.conn.dropBody'),
      confirm: t('phoneShare.conn.drop'), danger: true
    });
    if (!yes) return;
    try {
      await disconnectDevice(ctx, device.id);
      toast(t('phoneShare.conn.dropped'));
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('phoneShare.conn.dropFailed'));
    }
    await load();
    onChanged();
  };

  return (
    <section className="ph-conn" aria-labelledby="ph-conn-title">
      <h2 id="ph-conn-title" className="wk-h2">{t('phoneShare.conn.title')}</h2>
      <p className="ph-shares-intro">
        {t('phoneShare.conn.intro')}
      </p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {devices === null && failed === null && <Loading lines={1} label={t('phoneShare.conn.loading')} />}
      {devices === 'old' && <p className="wk-empty">{t('phoneShare.conn.old')}</p>}
      {Array.isArray(devices) && devices.length > 0 && (
        <ul className="ph-shares" aria-label={t('phoneShare.conn.list')}>
          {devices.map((d) => (
            <li key={d.id} className="ph-share">
              <span className="ph-share-name"><Icon name="mail" />{d.name ?? t('phoneShare.conn.mailProgram')}</span>
              <small>
                {t('phoneShare.conn.connected', { date: day(d.createdAt) })} · {d.lastUsedAt === null ? t('phoneShare.conn.nothingYet') : t('phoneShare.conn.lastUsed', { date: day(d.lastUsedAt) })}
                {d.shares > 0 ? ` · ${t('phoneShare.conn.files', { count: d.shares, size: sizeText(d.bytes) })}` : ''}
              </small>
              <span className="ph-share-tools">
                <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void drop(d)}><Icon name="ban" />{t('phoneShare.conn.drop')}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(devices) && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => setConnecting(true)}><Icon name="plus" />{t('phoneShare.conn.connect')}</button>
        </div>
      )}
      {connecting && <ConnectDialog ctx={ctx} onClose={() => { setConnecting(false); void load(); }} />}
    </section>
  );
}

/** Ein Programm verbinden: erst der Name, dann der Kod — einmal gezeigt, mit den drei Schritten in Thunderbird. */
function ConnectDialog({ ctx, onClose }: { ctx: PhoneCtx; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('Thunderbird');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      setCode((await connectDevice(ctx, name)).code);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('phoneShare.conn.codeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (code === null) return;
    void navigator.clipboard?.writeText(code).then(() => toast(t('phoneShare.conn.codeCopied')))
      .catch(() => toast(t('phoneShare.conn.codeCopyFailed')));
  };

  return (
    <Modal title={t('phoneShare.conn.connect')} onClose={onClose} wide>
      {code === null ? (
        <div className="wk-form">
          <label className="wk-field">
            <span>{t('phoneShare.conn.name')}</span>
            <input value={name} maxLength={60} placeholder={t('phoneShare.conn.namePh')} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void make()}>
              <Icon name="key" />{busy ? t('phoneShare.conn.making') : t('phoneShare.conn.make')}
            </button>
            <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="wk-form">
          <ol className="ph-conn-steps">
            <li>
              {rich(t('phoneShare.conn.step1'), { a: (s) => <a href={ADDON} download="recreatio-filelink.xpi">{s}</a> })}
            </li>
            <li>{rich(t('phoneShare.conn.step2'), { b: (s) => <b>{s}</b> })}</li>
            <li>
              {t('phoneShare.conn.step3')}
            </li>
          </ol>
          <label className="wk-field">
            <span>{t('phoneShare.conn.code')}</span>
            <textarea className="ph-conn-code" readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={copy}><Icon name="copy" />{t('phoneShare.conn.copyCode')}</button>
            <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.done')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ShareConnections;
