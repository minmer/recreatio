/**
 * DIE GLOCKE (0067) — oben in der Kopfleiste, auf jeder Seite des
 * Arbeitsplatzes: was neu ist, mit einem Klick dorthin.
 *
 * <b>Sie fragt nicht selbst</b> — sie zeigt, was `notify.ts` im Takt holt,
 * und plant die Erinnerungen an Aufgaben (einmal je halbe Stunde und beim
 * Zurückkommen; Aufgaben ändern sich selten).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { background, native, notices, type BackgroundStatus } from './platform';
import {
  applyBackground, chatLabel, current, loadDevices, loadSettings, dropDevice, markSeen, onToast, planReminders, refresh, saveSettings,
  start, subscribe, thisDevice, type DeviceList, type NotifySettings, type Reminder, type Toast
} from './notify';
import { keysFor } from './ringOf';
import { viewPath } from './routes';
import type { Who } from './session';
import { loadTasks, openTasks, upcomingReminders } from './tasks';

const REMINDERS_EVERY = 30 * 60_000;

/** Die Erinnerungen der nächsten sieben Tage in den Wecker. */
async function planFor(who: Who): Promise<void> {
  const now = new Date();
  const { tasks } = await loadTasks(new Date(now.getTime() - 86400_000), new Date(now.getTime() + 7 * 86400_000));
  const withReminders = tasks.filter((t) => (t.remind ?? 0) !== 0);
  if (withReminders.length === 0) { await planReminders([]); return; }

  /* Titel nur, wenn der Schlüssel offen ist — sonst „Zadanie", die Zeit stimmt trotzdem. */
  const { ring } = await keysFor(who).catch(() => ({ ring: null }));
  const named = ring === null ? withReminders.map((t) => ({ ...t, title: 'Zadanie', notes: null })) : await openTasks(ring, withReminders);

  const list: Reminder[] = named.flatMap((task) => upcomingReminders(task, now).map((r) => ({
    taskId: task.taskId, occurrenceAt: r.occurrenceAt, kind: r.kind, at: r.at, title: task.title
  })));
  await planReminders(list.sort((a, b) => a.at.getTime() - b.at.getTime()));
}

export function NotifyBell({ who }: { who: Who }) {
  const state = useSyncExternalStore(subscribe, current);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => start(), []);

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
  const count = d === null ? 0 : d.chats.unread + d.registrations.count + d.links;

  return (
    <div className="wk-bell" ref={box}>
      <button type="button" className={`wk-bell-btn${count > 0 ? ' has-news' : ''}`} aria-expanded={open}
        aria-label={count > 0 ? `Powiadomienia: ${count} nowych` : 'Powiadomienia'}
        onClick={() => { setOpen((was) => !was); if (!open) void refresh(); }}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.2A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.8L18 12.6V9a6 6 0 0 0-6-6Zm0 19a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2Z" fill="currentColor" />
        </svg>
        {count > 0 && <span className="wk-bell-count">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="wk-bell-panel" role="dialog" aria-label="Powiadomienia">
          {d === null ? <p className="wk-hint">Sprawdzanie…</p> : (
            <>
              <Group title="Rozmowy" empty="Wszystko przeczytane.">
                {d.chats.list.map((c) => (
                  <a key={c.chatId} className="wk-bell-item" href={viewPath('chat', c.chatId)} onClick={() => setOpen(false)}>
                    <span>{chatLabel(c)}{c.quiet ? ' (wyciszona)' : ''}</span>
                    <span className="wk-bell-n">{c.unread}</span>
                  </a>
                ))}
              </Group>

              <Group title="Nowe zgłoszenia" empty="Nic nowego od ostatniego razu.">
                {d.registrations.list.map((f) => (
                  <a key={f.moduleId} className="wk-bell-item" href={viewPath('modules', 'form', f.moduleId)} onClick={() => setOpen(false)}>
                    <span>{f.name}</span>
                    <span className="wk-bell-n">{f.count}</span>
                  </a>
                ))}
              </Group>

              {d.links > 0 && (
                <Group title="Linki dostępu">
                  <a className="wk-bell-item" href={viewPath('areas')} onClick={() => setOpen(false)}>
                    <span>Dołączyło przez link</span><span className="wk-bell-n">{d.links}</span>
                  </a>
                </Group>
              )}

              {d.tasks > 0 && (
                <Group title="Zadania">
                  <a className="wk-bell-item" href={viewPath('tasks')} onClick={() => setOpen(false)}>
                    <span>Do zrobienia teraz</span><span className="wk-bell-n">{d.tasks}</span>
                  </a>
                </Group>
              )}

              <div className="wk-actions">
                {(d.registrations.count > 0 || d.links > 0) && (
                  <button type="button" className="wk-link-btn" onClick={markSeen}>Oznacz jako przejrzane</button>
                )}
                <button type="button" className="wk-link-btn" onClick={() => { setSettingsOpen(true); setOpen(false); }}>Ustawienia…</button>
              </div>
            </>
          )}
        </div>
      )}

      {settingsOpen && <NotifySettingsPanel settings={state.settings} onClose={() => setSettingsOpen(false)} />}

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
            <button type="button" className="wk-toast-close" aria-label="Zamknij" onClick={() => setToast(null)}>×</button>
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

function Group({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children === null || children === false ? [] : [children];
  return (
    <section className="wk-bell-group">
      <h3>{title}</h3>
      {items.length === 0 ? (empty !== undefined && <p className="wk-hint">{empty}</p>) : children}
    </section>
  );
}

/**
 * 0075 — kommt eine Nachricht SOFORT (Push) oder erst beim nächsten Nachsehen?
 * Drei Stellen müssen mitspielen: die App (mit Firebase gebaut), der Dienst
 * (Firebase eingerichtet) und dieses Gerät (seine Kennung kam an).
 */
function pushWords(listed: DeviceList | null, phone: BackgroundStatus | null, mine: string | null): string {
  if (listed === null || phone === null) return 'Sprawdzanie…';
  if (phone.pushBuilt === false) return 'Natychmiastowe powiadomienia: ta wersja aplikacji ich nie obsługuje — nowości przychodzą przy sprawdzaniu w tle.';
  if (listed.push?.available !== true) return 'Natychmiastowe powiadomienia: serwer jeszcze ich nie wysyła — nowości przychodzą przy sprawdzaniu w tle.';
  const row = listed.devices.find((d) => d.deviceId === mine);
  if (row?.push !== true) return 'Natychmiastowe powiadomienia: telefon jeszcze się nie zgłosił (potrzebny internet i usługi Google). Spróbuj ponownie uruchomić aplikację.';
  const failed = row.pushError !== null && row.pushError !== undefined ? ` Ostatni błąd: ${row.pushError}.` : '';
  return `Natychmiastowe powiadomienia: włączone — nowa wiadomość budzi telefon od razu; sprawdzanie w tle to tylko zabezpieczenie.${failed}`;
}

const BACKGROUND: readonly { value: NotifySettings['backgroundMinutes']; label: string }[] = [
  { value: 0, label: 'nigdy' },
  { value: 15, label: 'co 15 min (więcej baterii)' },
  { value: 30, label: 'co 30 min' },
  { value: 60, label: 'co godzinę' },
  { value: 180, label: 'co 3 godziny (najmniej baterii)' }
];

function NotifySettingsPanel({ settings, onClose }: { settings: NotifySettings; onClose: () => void }) {
  const [allowed, setAllowed] = useState(notices.allowed());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [listed, setListed] = useState<DeviceList | null>(null);
  const [phone, setPhone] = useState<BackgroundStatus | null>(null);
  const devices = listed?.devices ?? [];
  const mine = native ? thisDevice()?.deviceId ?? null : null;

  const look = () => {
    void loadDevices().then(setListed).catch(() => undefined);
    if (native) void background.status().then(setPhone);
  };
  useEffect(look, []);

  const set = (patch: Partial<NotifySettings>) => {
    const next = { ...settings, ...patch };
    saveSettings(next);
    if (native && ('backgroundMinutes' in patch || 'chats' in patch || 'forms' in patch || 'links' in patch)) {
      setBusy(true);
      void applyBackground(next)
        .then(() => setNote(next.backgroundMinutes === 0 ? 'Sprawdzanie w tle wyłączone.' : 'Zapisano.'))
        .catch(() => setNote('Nie udało się zapisać ustawień urządzenia.'))
        .finally(() => { setBusy(false); look(); });
    }
    if ('reminders' in patch) window.dispatchEvent(new Event('recreatio:tasks-changed'));
  };

  return (
    <div className="wk-bell-settings" role="dialog" aria-label="Ustawienia powiadomień">
      <h2 className="wk-h2">Powiadomienia</h2>

      {notices.available && !allowed && (
        <p>
          <button type="button" className="wk-btn" onClick={() => void notices.ask().then((ok) => {
            setAllowed(ok);
            if (ok && native) void applyBackground(settings).finally(look);
            else if (!ok && native) setNote('Android nie pozwolił. Włącz powiadomienia dla recreatio w ustawieniach telefonu (Aplikacje → recreatio → Powiadomienia).');
          })}>Włącz powiadomienia na tym urządzeniu</button>
        </p>
      )}
      {!notices.available && <p className="wk-hint">Ta przeglądarka nie pokazuje powiadomień — nowości widać w dzwonku.</p>}

      <fieldset className="wk-field">
        <legend>Powiadamiaj o</legend>
        <label className="wk-check"><input type="checkbox" checked={settings.chats} onChange={(e) => set({ chats: e.target.checked })} /> <span>nowych wiadomościach</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.forms} onChange={(e) => set({ forms: e.target.checked })} /> <span>nowych zgłoszeniach z formularzy</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.links} onChange={(e) => set({ links: e.target.checked })} /> <span>dołączeniach przez linki dostępu</span></label>
        <label className="wk-check"><input type="checkbox" checked={settings.reminders} onChange={(e) => set({ reminders: e.target.checked })} /> <span>przypomnieniach o zadaniach</span></label>
      </fieldset>

      {native ? (
        <label className="wk-field">
          <span>Gdy aplikacja jest zamknięta, sprawdzaj</span>
          <select value={settings.backgroundMinutes} disabled={busy}
            onChange={(e) => set({ backgroundMinutes: Number(e.target.value) as NotifySettings['backgroundMinutes'] })}>
            {BACKGROUND.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <span className="wk-hint">Telefon sprawdza tylko liczby (bez treści), tylko z internetem i gdy bateria nie jest na wyczerpaniu. Przypomnienia o zadaniach przychodzą o czasie także bez tego.</span>
          {settings.backgroundMinutes !== 0 && <span className="wk-note">{pushWords(listed, phone, mine)}</span>}
        </label>
      ) : (
        <p className="wk-hint">
          W przeglądarce: co minutę, gdy karta jest na wierzchu (nowości pokazują się wtedy na stronie), co 5 minut w tle; przy słabej baterii rzadziej.
          Gdy karta jest zamknięta, powiadomień nie ma — zainstaluj aplikację na telefonie, żeby dostawać je zawsze.
        </p>
      )}

      {devices.length > 0 && (
        <section>
          <h3 className="wk-h3">Urządzenia, które sprawdzają w tle</h3>
          <ul className="wk-link-list">
            {devices.map((dv) => (
              <li key={dv.deviceId} className="wk-link-item">
                <span>
                  {dv.label ?? 'Urządzenie'}{dv.deviceId === mine ? ' (to urządzenie)' : ''}
                  {' · '}ostatnio {dv.lastSeenAt === null ? 'jeszcze nigdy' : new Date(dv.lastSeenAt).toLocaleString('pl-PL')}
                  {dv.push === true && ' · od razu (push)'}
                </span>
                <button type="button" className="wk-link-btn" onClick={() => void dropDevice(dv.deviceId)
                  .then(() => setListed((was) => was === null ? was : { ...was, devices: was.devices.filter((x) => x.deviceId !== dv.deviceId) }))}>Odłącz</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {note !== null && <p className="wk-note">{note}</p>}
      <div className="wk-actions"><button type="button" className="wk-btn" onClick={onClose}>Gotowe</button></div>
    </div>
  );
}

export default NotifyBell;
