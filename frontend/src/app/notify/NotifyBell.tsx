/**
 * DIE GLOCKE (0067) — oben in der Kopfleiste, auf jeder Seite des
 * Arbeitsplatzes: was neu ist, mit einem Klick dorthin.
 *
 * <b>Sie fragt nicht selbst</b> — sie zeigt, was `notify.ts` im Takt holt,
 * und plant die Erinnerungen an Aufgaben (einmal je halbe Stunde und beim
 * Zurückkommen; Aufgaben ändern sich selten).
 *
 * 0076 — in der App stehen in den Meldungen die Inhalte selbst (wer, was, ein
 * Antwortfeld); geöffnet auf dem Telefon (`notifyRich.ts`). Die Einstellungen
 * sagen, ob das bei geschlossener App geht (Klucz: Zachowany auf diesem Gerät).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { background, native, notices, type BackgroundStatus } from '../core/platform';
import {
  applyBackground, current, loadDevices, loadSettings, dropDevice, markSeen, onToast, planReminders, refresh, saveSettings,
  start, subscribe, thisDevice, type DeviceList, type NotifySettings, type Toast
} from './notify';
import { remindersFor } from './notifyRich';
import { alertCount, alertItems, useAlertSettings } from '../workspace/alerts';
import { AlertRows } from '../workspace/AlertList';
import { knownDevice } from '../core/kept';
import { keysFor } from '../core/ringOf';
import { viewPath } from '../routes';
import { keepsKey, type Who } from '../core/session';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { useT, type T } from '../core/i18n';

const REMINDERS_EVERY = 30 * 60_000;

/** Die Erinnerungen der nächsten sieben Tage in den Wecker — Titel nur, wenn der Schlüssel offen ist. */
async function planFor(who: Who): Promise<void> {
  const { ring } = await keysFor(who).catch(() => ({ ring: null }));
  await planReminders(await remindersFor(ring));
}

export function NotifyBell({ who }: { who: Who }) {
  const state = useSyncExternalStore(subscribe, current);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => start(who), [who]);

  /*
   * In der App, bei jedem Start (0075): erst, wenn klar ist, ob Meldungen
   * erlaubt sind (`notices.ready` — vorher sagt `allowed()` immer „nein"). Beim
   * ersten Start fragt die App einmal selbst (Android 13+ zeigt sonst nichts);
   * danach nur noch über den Knopf in den Einstellungen. Ist es erlaubt, steht
   * der Arbeiter und der Wecker — auch nach einer Neuinstallation oder wenn
   * das Gerät anderswo abgemeldet wurde.
   */
  useEffect(() => {
    if (!native) return;
    let live = true;
    void (async () => {
      await notices.ready();
      if (!notices.allowed() && !askedBefore()) {
        markAsked();
        await notices.ask();
      }
      const settings = loadSettings();
      if (!live || !notices.allowed() || settings.backgroundMinutes === 0) return;
      await applyBackground(settings).catch(() => undefined);
    })();
    return () => { live = false; };
  }, []);

  /* Hinweise auf der Seite (Browser, Seite vorn): einer zur Zeit, nach 8 s weg. */
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => onToast(setToast), []);
  useEffect(() => {
    if (toast === null) return;
    const gone = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(gone);
  }, [toast]);

  /* Erinnerungen planen: jetzt, alle 30 min, und wenn man zurückkommt. */
  useEffect(() => {
    let last = 0;
    const plan = () => {
      if (Date.now() - last < 5 * 60_000) return;
      last = Date.now();
      void planFor(who).catch(() => undefined);
    };
    plan();
    const every = window.setInterval(plan, REMINDERS_EVERY);
    const onVisible = () => { if (document.visibilityState === 'visible') plan(); };
    const onChanged = () => { last = 0; plan(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('recreatio:tasks-changed', onChanged);
    return () => {
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('recreatio:tasks-changed', onChanged);
    };
  }, [who]);

  /* Zu, wenn man daneben klickt. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const d = state.digest;
  const [alertSettings] = useAlertSettings();
  const items = alertItems(d, null, alertSettings, null);
  const count = alertCount(d, alertSettings);

  return (
    <div className="wk-bell" ref={box}>
      <button type="button" className={`wk-bar-btn wk-bell-btn${count > 0 ? ' has-news' : ''}`} aria-expanded={open}
        aria-label={count > 0 ? t('notify.bell.labelNew', { count }) : t('notify.look.title')}
        onClick={() => { setOpen((was) => !was); if (!open) void refresh(); }}>
        <Icon name="bell" />
        {count > 0 && <span className="wk-bell-count">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="wk-bell-panel" role="dialog" aria-label={t('notify.look.title')}>
          {d === null ? <Loading label={t('notify.bell.checking')} /> : (
            <>
              {/* 0094 — in der Reihenfolge, die das Konto gewählt hat (Konto → Wygląd warsztatu); ✓ wo es geht (0090). */}
              {items.length === 0
                ? <p className="wk-hint">{t('notify.bell.nothing')}</p>
                : <AlertRows items={items} onPick={() => setOpen(false)} />}

              <div className="wk-actions">
                {(d.registrations.count > 0 || d.links > 0) && (
                  <button type="button" className="wk-link-btn" onClick={markSeen}>{t('notify.bell.markAll')}</button>
                )}
                {/* Was sich meldet und in welcher Reihenfolge — und was dieses Gerät tut: eine Seite (Powiadomienia). */}
                <a className="wk-link-btn" href={viewPath('account', 'widok')} onClick={() => setOpen(false)}>{t('notify.bell.settings')}</a>
              </div>
            </>
          )}
        </div>
      )}


      <div className="wk-toasts" aria-live="polite">
        {toast !== null && (
          <div key={toast.id} className="wk-toast" role="status">
            {toast.open !== undefined ? (
              <a className="wk-toast-body" href={toast.open} onClick={() => setToast(null)}>
                <strong>{toast.title}</strong><span>{toast.body}</span>
              </a>
            ) : (
              <div className="wk-toast-body"><strong>{toast.title}</strong><span>{toast.body}</span></div>
            )}
            <button type="button" className="wk-toast-close" aria-label={t('common.close')} onClick={() => setToast(null)}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Einmal von selbst um Erlaubnis bitten — Android fragt ohnehin höchstens zweimal, dann nie wieder. */
const ASKED_SLOT = 'recreatio:notify:asked';
const askedBefore = (): boolean => {
  try { return localStorage.getItem(ASKED_SLOT) !== null; } catch { return true; }
};
const markAsked = (): void => {
  try { localStorage.setItem(ASKED_SLOT, new Date().toISOString()); } catch { /* dann eben beim nächsten Start noch einmal */ }
};

/**
 * 0075 — kommt eine Nachricht SOFORT (Push) oder erst beim nächsten Nachsehen?
 * Drei Stellen müssen mitspielen: die App (mit Firebase gebaut), der Dienst
 * (Firebase eingerichtet) und dieses Gerät (seine Kennung kam an).
 */
function pushWords(listed: DeviceList | null, phone: BackgroundStatus | null, mine: string | null, t: T): string {
  if (listed === null || phone === null) return t('notify.bell.checking');
  if (phone.pushBuilt === false) return t('notify.push.notBuilt');
  if (listed.push?.available !== true) return t('notify.push.notServer');
  const row = listed.devices.find((d) => d.deviceId === mine);
  if (row?.push !== true) return t('notify.push.notPhone');
  const failed = row.pushError !== null && row.pushError !== undefined ? ` ${t('notify.push.lastError', { error: row.pushError })}` : '';
  return `${t('notify.push.on')}${failed}`;
}

/* Bezeichnung je Takt: `notify.background.<value>`. */
const BACKGROUND: readonly NotifySettings['backgroundMinutes'][] = [0, 15, 30, 60, 180];

/**
 * 0076 — kann das Telefon bei GESCHLOSSENER App den Inhalt öffnen? Dazu muss
 * der Schlüssel auf diesem Gerät verwahrt sein (Klucz: Zachowany) — der Läufer
 * im Hintergrund hat kein Passwort.
 */
function contentWords(kept: boolean | null, phone: BackgroundStatus | null, t: T): string {
  if (kept === null) return t('notify.bell.checking');
  if (!kept) return t('notify.content.notKept');
  const last = phone?.richResult ?? null;
  const when = phone?.richAt === null || phone?.richAt === undefined ? '' : ` ${t('notify.content.when', { date: new Date(phone.richAt).toLocaleString(t.locale) })}`;
  if (last === 'locked:session') return t('notify.content.session', { when });
  if (last === 'locked:key') return t('notify.content.key', { when });
  if (last !== null && last.startsWith('failed')) return t('notify.content.failed', { when });
  return t('notify.content.ok', { when });
}

export function NotifySettingsPanel({ who, settings, onClose }: { who: Who; settings: NotifySettings; onClose?: () => void }) {
  const [kept, setKept] = useState<boolean | null>(null);
  useEffect(() => {
    if (!native) return;
    void knownDevice().then((on) => setKept(keepsKey(who) && on !== null)).catch(() => setKept(false));
  }, [who]);
  const [allowed, setAllowed] = useState(notices.allowed());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [listed, setListed] = useState<DeviceList | null>(null);
  const [phone, setPhone] = useState<BackgroundStatus | null>(null);
  const devices = listed?.devices ?? [];
  const mine = native ? thisDevice()?.deviceId ?? null : null;
  const t = useT();

  const look = () => {
    void loadDevices().then(setListed).catch(() => undefined);
    if (native) void background.status().then(setPhone);
  };
  useEffect(look, []);

  const set = (patch: Partial<NotifySettings>) => {
    const next = { ...settings, ...patch };
    saveSettings(next);
    if (native && ('backgroundMinutes' in patch || 'chats' in patch || 'forms' in patch || 'links' in patch || 'contents' in patch || 'reminders' in patch)) {
      setBusy(true);
      void applyBackground(next)
        .then(() => setNote(next.backgroundMinutes === 0 ? t('notify.settings.backgroundOff') : t('common.saved')))
        .catch(() => setNote(t('notify.settings.saveFailed')))
        .finally(() => { setBusy(false); look(); });
    }
    if ('reminders' in patch) window.dispatchEvent(new Event('recreatio:tasks-changed'));
  };

  return (
    <div className="wk-bell-settings" role="dialog" aria-label={t('notify.settings.label')}>
      <h2 className="wk-h2">{t('notify.look.title')}</h2>

      {notices.available && !allowed && (
        <p>
          <button type="button" className="wk-btn" onClick={() => void notices.ask().then((ok) => {
            setAllowed(ok);
            if (ok && native) void applyBackground(settings).finally(look);
            else if (!ok && native) setNote(t('notify.settings.denied'));
          })}>{t('notify.settings.enable')}</button>
        </p>
      )}
      {!notices.available && <p className="wk-hint">{t('notify.settings.noBrowser')}</p>}

      <fieldset className="wk-field">
        <legend>{t('notify.settings.about')}</legend>
        <label className="wk-check"><input type="checkbox" checked={settings.chats} onChange={(e) => set({ chats: e.target.checked })} /> <span>{t('notify.settings.chats')}</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.forms} onChange={(e) => set({ forms: e.target.checked })} /> <span>{t('notify.settings.forms')}</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.links} onChange={(e) => set({ links: e.target.checked })} /> <span>{t('notify.settings.links')}</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.reminders} onChange={(e) => set({ reminders: e.target.checked })} /> <span>{t('notify.settings.reminders')}</span></label>
      </fieldset>

      {native && (
        <fieldset className="wk-field">
          <legend>{t('notify.settings.contentTitle')}</legend>
          <label className="wk-check">
            <input type="checkbox" checked={settings.contents} onChange={(e) => set({ contents: e.target.checked })} />
            {' '}<span>{t('notify.settings.contents')}</span>
          </label>
          {settings.contents && <span className="wk-hint">{contentWords(kept, phone, t)}</span>}
          {settings.contents && <span className="wk-hint">{t('notify.settings.lockScreen')}</span>}
        </fieldset>
      )}

      {native ? (
        <label className="wk-field">
          <span>{t('notify.settings.whenClosed')}</span>
          <select value={settings.backgroundMinutes} disabled={busy}
            onChange={(e) => set({ backgroundMinutes: Number(e.target.value) as NotifySettings['backgroundMinutes'] })}>
            {BACKGROUND.map((b) => <option key={b} value={b}>{t(`notify.background.m${b}`)}</option>)}
          </select>
          <span className="wk-hint">{t('notify.settings.phoneHint')}</span>
          {settings.backgroundMinutes !== 0 && <span className="wk-note">{pushWords(listed, phone, mine, t)}</span>}
        </label>
      ) : (
        <p className="wk-hint">{t('notify.settings.browserHint')}</p>
      )}

      {devices.length > 0 && (
        <section>
          <h3 className="wk-h3">{t('notify.settings.devices')}</h3>
          <ul className="wk-link-list">
            {devices.map((dv) => (
              <li key={dv.deviceId} className="wk-link-item">
                <span>
                  {dv.label ?? t('notify.settings.device')}{dv.deviceId === mine ? ` ${t('notify.settings.thisDevice')}` : ''}
                  {' · '}{t('notify.settings.lastSeen', { when: dv.lastSeenAt === null ? t('notify.settings.never') : new Date(dv.lastSeenAt).toLocaleString(t.locale) })}
                  {dv.push === true && ` · ${t('notify.settings.push')}`}
                </span>
                <button type="button" className="wk-link-btn" onClick={() => void dropDevice(dv.deviceId)
                  .then(() => setListed((was) => was === null ? was : { ...was, devices: was.devices.filter((x) => x.deviceId !== dv.deviceId) }))}>{t('notify.settings.drop')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {note !== null && <p className="wk-note">{note}</p>}
      {onClose !== undefined && <div className="wk-actions"><button type="button" className="wk-btn" onClick={onClose}>{t('common.done')}</button></div>}
    </div>
  );
}

export default NotifyBell;
