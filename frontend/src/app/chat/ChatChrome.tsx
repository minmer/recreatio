/**
 * Was um den Verlauf herum steht: der Status im Kopf, geplante Nachrichten, wer schreiben darf.
 */

import { useEffect, useState } from 'react';

import { call } from '../core/session';
import { Modal } from '../ui/Modal';
import { type SealedMessage, openMessage } from './chat';
import { PreferencesEditor, type useChatExtras } from './ChatExtras';
import { availableNow, lastOnline, useOnline } from './chatFeatures';
import { Icon, type MenuItem, failure, localInput, whenLong } from './ChatKit';
import { useT } from '../core/i18n';

/* -- Was jede Rozmowa im Menü ⋮ hat ------------------------------------------------------------- */

interface Planned extends SealedMessage {
  readonly sendAt: string;
  readonly state: string;
  readonly preview: string;
  /** 0111 — wartet, bis jemand online ist (`sendAt` ist dann nur das „najpóźniej"). */
  readonly whenOnline?: boolean;
  readonly silent?: boolean;
}

/** Die eigenen geplanten Nachrichten — mit dem Text, den nur der Absender öffnen kann. */
export function useScheduled(endpoint: string, keys: ReadonlyMap<number, Uint8Array>) {
  const t = useT();
  const [list, setList] = useState<readonly Planned[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () => call<{ messages: (SealedMessage & { sendAt: string; state: string; whenOnline?: boolean; silent?: boolean })[] }>(`${endpoint}/scheduled`)
      .then(async (found) => {
        const opened = await Promise.all(found.messages.map(async (m) => {
          const o = await openMessage(keys, m);
          const files = o?.attachments?.length ?? 0;
          return { ...m, preview: o === null ? t('chat.chrome.noKeyMessage') : o.text !== '' ? o.text : files > 0 ? t('chat.chrome.attachments', { count: files }) : '' };
        }));
        if (live) setList(opened);
      })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [endpoint, keys, round, t]);

  return {
    list,
    refresh: () => setRound((n) => n + 1),
    drop: (id: string) => setList((was) => was.filter((m) => m.messageId !== id))
  };
}

/**
 * WAS JEDE ROZMOWA IM MENÜ ⋮ HAT — Zapisane, Przypięte, Zaplanowane,
 * Powiadomienia; wer moderiert, dazu „Kto może pisać". Dazu die Leiste unter
 * dem Kopf (Filter, Fehler), das Plättchen der geplanten über dem Feld und
 * was der Kopf über den Zustand sagt.
 */
export function useChatChrome({ endpoint, extras, keys, canModerate = false, onPolicy }: {
  endpoint: string;
  extras: ReturnType<typeof useChatExtras>;
  keys: ReadonlyMap<number, Uint8Array>;
  canModerate?: boolean;
  onPolicy?: () => void;
}) {
  const t = useT();
  const scheduled = useScheduled(endpoint, keys);
  const [panel, setPanel] = useState<'prefs' | 'scheduled' | 'policy' | null>(null);
  const f = extras.features;
  const filter = extras.filter;
  /* 0111 — solange die Rozmowa offen ist, ist man „w aplikacji" (ein Platz über seinen Link, ein Konto überhaupt). */
  useOnline(endpoint.startsWith('/seat/') ? `${endpoint}/online` : '/workspace/online');

  const items: MenuItem[] = [
    { label: t('chat.chrome.starred'), icon: 'star', checked: filter === 'star', disabled: f === null, onSelect: () => extras.setFilter(filter === 'star' ? 'all' : 'star') },
    { label: t('chat.chrome.pinned'), icon: 'pin', checked: filter === 'pin', disabled: f === null, onSelect: () => extras.setFilter(filter === 'pin' ? 'all' : 'pin') },
    { label: scheduled.list.length > 0 ? t('chat.chrome.scheduledCount', { count: scheduled.list.length }) : t('chat.chrome.scheduled'), icon: 'clock', onSelect: () => setPanel('scheduled') },
    { label: t('chat.chrome.prefs'), icon: 'bell', disabled: f === null, onSelect: () => setPanel('prefs') },
    ...(canModerate ? [{ label: t('chat.chrome.policy'), icon: 'users' as const, disabled: f === null, onSelect: () => setPanel('policy') }] : [])
  ];

  const banner = (
    <>
      {extras.loadError !== null && (
        <p className="ch-bar is-error" role="alert">{t('chat.chrome.loadFailed', { error: extras.loadError })}</p>
      )}
      {filter !== 'all' && (
        <p className="ch-bar">
          <Icon name={filter === 'star' ? 'star' : 'pin'} />
          <span>{t(filter === 'star' ? 'chat.chrome.onlyStarred' : 'chat.chrome.onlyPinned')}</span>
          <button type="button" className="wk-link-btn" onClick={() => extras.setFilter('all')}>{t('chat.chrome.showAll')}</button>
        </p>
      )}
    </>
  );

  const chip = scheduled.list.length === 0 ? null : (
    <button type="button" className="ch-chip ch-sched-chip" onClick={() => setPanel('scheduled')}>
      <Icon name="clock" /> {scheduled.list.length === 1 ? t('chat.chrome.oneScheduled') : t('chat.chrome.scheduledN', { count: scheduled.list.length })}
    </button>
  );

  const dialogs = (
    <>
      {panel === 'prefs' && f !== null && (
        <Modal title={t('chat.chrome.prefs')} onClose={() => setPanel(null)}>
          <PreferencesEditor key={endpoint} value={f.settings ?? f.common} inherited={f.settings === null} onSave={async (p) => {
            await call(`${endpoint}/preferences`, { method: 'PUT', body: JSON.stringify({ settings: p }) });
            await extras.refresh();
          }} />
        </Modal>
      )}
      {panel === 'scheduled' && <ScheduledDialog endpoint={endpoint} scheduled={scheduled} onClose={() => setPanel(null)} onSent={() => void extras.refresh()} />}
      {panel === 'policy' && f !== null && (
        <PolicyDialog endpoint={endpoint} policy={f.postingPolicy} onClose={() => setPanel(null)}
          onDone={() => { void extras.refresh(); onPolicy?.(); }} />
      )}
    </>
  );

  const status = {
    typing: (f?.typing ?? 0) > 0,
    quiet: f !== null && (f.effective.muted || !availableNow(f.effective)),
    channel: f?.postingPolicy === 'writers',
    available: f?.receipts.filter((r) => r.available === true).length ?? 0,
    away: f?.receipts.filter((r) => r.available === false).length ?? 0,
    /* 0111 — wer zeigt, wann er in der App ist: wie viele jetzt, und wie viele es überhaupt zeigen. */
    online: f?.receipts.filter((r) => r.online === true).length ?? 0,
    sharing: f?.receipts.filter((r) => r.online === true || r.online === false).length ?? 0
  };

  /*
   * 0111 — „GDY BĘDZIE ONLINE" gibt es nur, wenn jemand aus der Rozmowa zeigt,
   * wann er da ist (sonst verriete die Zustellung es) — und wenn er gerade
   * nicht da ist, wäre es dasselbe wie „Wyślij": dann steht es nicht im Menü.
   */
  const onlineSend = status.sharing === 0 || status.online > 0 ? null
    : status.sharing === 1 ? t('chat.chrome.sendWhenOnline') : t('chat.chrome.sendWhenAnyOnline');

  /* 0111 — was der Kopf darüber sagt: „online", „online: 3", oder wann der eine, der es teilt, zuletzt da war. */
  const last = status.sharing === 1 ? f?.receipts.find((r) => r.online === false)?.onlineAt ?? null : null;
  const presence = status.online > 0 ? (status.sharing === 1 ? t('chat.chrome.online') : t('chat.chrome.onlineN', { count: status.online }))
    : last !== null ? t('chat.chrome.lastSeen', { when: lastOnline(last) }) : null;

  return { items, banner, chip, dialogs, status, scheduled, onlineSend, presence };
}

function ScheduledDialog({ endpoint, scheduled, onClose, onSent }: {
  endpoint: string;
  scheduled: ReturnType<typeof useScheduled>;
  onClose: () => void;
  /** 0111 — eine ging gerade hinaus („Wyślij teraz"). */
  onSent?: () => void;
}) {
  const t = useT();
  const [said, setSaid] = useState<string | null>(null);

  return (
    <Modal title={t('chat.chrome.scheduledTitle')} onClose={onClose}>
      {scheduled.list.length === 0 ? (
        <p className="wk-hint">
          {t('chat.chrome.nothingScheduled')}
        </p>
      ) : (
        <ul className="ch-planned">
          {scheduled.list.map((m) => (
            <li key={m.messageId}>
              <p className="ch-planned-text">{m.preview || t('chat.chrome.message')}</p>
              <p className={m.state === 'failed' ? 'wk-error' : 'wk-hint'}>
                {m.whenOnline === true ? t('chat.chrome.whenOnlineLatest', { when: whenLong(m.sendAt, t.lang) }) : whenLong(m.sendAt, t.lang)}
                {m.silent === true ? ` · ${t('chat.chrome.silent')}` : ''}
                {' — '}{m.state === 'failed' ? t('chat.chrome.notSent') : t('chat.chrome.waiting')}
              </p>
              <div className="ch-planned-tools">
                {m.state === 'pending' && (
                  <button type="button" className="wk-link-btn" onClick={() => {
                    void call(`${endpoint}/scheduled/${m.messageId}/now`, { method: 'POST' })
                      .then(() => { scheduled.drop(m.messageId); setSaid(t('chat.chrome.sent')); onSent?.(); })
                      .catch((e: unknown) => setSaid(failure(e, t('chat.chrome.sendFailed'))));
                  }}>{t('chat.chrome.sendNow')}</button>
                )}
                {m.state === 'pending' && (
                  <Reschedule endpoint={endpoint} messageId={m.messageId} sendAt={m.whenOnline === true ? new Date(Date.now() + 3_600_000).toISOString() : m.sendAt}
                    onDone={(text) => { setSaid(text); scheduled.refresh(); }} />
                )}
                <button type="button" className="wk-link-btn" onClick={() => {
                  void call(`${endpoint}/scheduled/${m.messageId}`, { method: 'DELETE' })
                    .then(() => { scheduled.drop(m.messageId); setSaid(t('chat.chrome.cancelled')); })
                    .catch((e: unknown) => setSaid(failure(e, t('chat.chrome.cancelFailed'))));
                }}>{t('chat.chrome.cancelSend')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {said !== null && <p className="wk-hint" role="status">{said}</p>}
    </Modal>
  );
}

function Reschedule({ endpoint, messageId, sendAt, onDone }: { endpoint: string; messageId: string; sendAt: string; onDone: (text: string) => void }) {
  const t = useT();
  const [value, setValue] = useState(() => localInput(new Date(sendAt)));
  return (
    <span className="ch-reschedule">
      <input type="datetime-local" aria-label={t('chat.chrome.newTime')} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" className="wk-link-btn" onClick={() => {
        if (value === '' || new Date(value).getTime() <= Date.now()) { onDone(t('chat.chrome.pickFuture')); return; }
        void call(`${endpoint}/scheduled/${messageId}`, { method: 'PUT', body: JSON.stringify({ sendAt: new Date(value).toISOString() }) })
          .then(() => onDone(t('chat.chrome.rescheduled')))
          .catch((e: unknown) => onDone(failure(e, t('chat.chrome.rescheduleFailed'))));
      }}>{t('chat.chrome.reschedule')}</button>
    </span>
  );
}

const POLICIES = [
  { value: 'members', label: 'chat.policy.members', hint: 'chat.policy.membersHint' },
  { value: 'writers', label: 'chat.policy.writers', hint: 'chat.policy.writersHint' }
] as const;

function PolicyDialog({ endpoint, policy, onDone, onClose }: { endpoint: string; policy: string; onDone: () => void; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <Modal title={t('chat.chrome.policy')} onClose={onClose}>
      <div className="ch-options" role="radiogroup" aria-label={t('chat.chrome.policy')}>
        {POLICIES.map((p) => (
          <label key={p.value} className="ch-option">
            <input type="radio" name="ch-policy" checked={policy === p.value} disabled={busy} onChange={() => {
              setBusy(true);
              setFailed(null);
              void call(`${endpoint}/policy`, { method: 'PUT', body: JSON.stringify({ postingPolicy: p.value }) })
                .then(() => { onDone(); onClose(); })
                .catch((e: unknown) => setFailed(failure(e, t('chat.chrome.changeFailed'))))
                .finally(() => setBusy(false));
            }} />
            <span><strong>{t(p.label)}</strong><small>{t(p.hint)}</small></span>
          </label>
        ))}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Modal>
  );
}
