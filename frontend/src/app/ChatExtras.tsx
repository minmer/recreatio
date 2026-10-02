import { useEffect, useRef, useState } from 'react';
import { areaKeys, chatKeysOf, loadChat, loadChats, openNames, sendMessage, type ChatDetail, type ChatRow, type Attachment, type Opened } from './chat';
import { availableNow, defaultPreferences, downloadAttachment, uploadAttachment, type Features, type Preferences } from './chatFeatures';
import { Modal } from './Modal';
import { notices } from './platform';
import { call } from './session';
import type { Ring } from './keys';
import { chatEndpoint } from './chatFeatures';

/**
 * `notify`: selbst melden, wenn die Seite verdeckt ist. Im Arbeitsplatz nicht
 * (0076) — dort meldet `notify.ts` jede Rozmowa, in der App mit Inhalt und
 * Antwortfeld; eine zweite Meldung daneben wäre doppelt. Auf einer Seite und
 * für den Menschen mit Link (ohne Konto, ohne Glocke) bleibt es hier.
 */
export function useChatExtras(endpoint: string, { notify = true }: { notify?: boolean } = {}) {
  const [features, setFeatures] = useState<Features | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastMessage = useRef<string | null | undefined>(undefined);
  const [filter, setFilter] = useState('all');
  const refresh = () => call<Features>(`${endpoint}/features`).then(f => { setFeatures(f); setLoadError(null); });
  useEffect(() => {
    let live = true;
    let loading = false;
    let retryAt = 0;
    let failures = 0;
    setFeatures(null); setLoadError(null); lastMessage.current = undefined;
    const load = () => {
      if (loading || Date.now() < retryAt) return;
      loading = true;
      return call<Features>(`${endpoint}/features`).then(f => { if (live) {
      if (notify && lastMessage.current !== undefined && f.lastMessageAt !== lastMessage.current && f.lastMessageAt
        && document.visibilityState !== 'visible' && !f.effective.muted && !f.effective.archived && availableNow(f.effective))
        notices.show({ title: 'Nowa wiadomość', body: 'W rozmowie pojawiła się wiadomość.', tag: endpoint });
      lastMessage.current = f.lastMessageAt; setFeatures(f); setLoadError(null); failures = 0;
    } }).catch(e => {
      if (live) setLoadError(e instanceof Error ? e.message : 'Nie udało się wczytać ustawień rozmowy.');
      retryAt = Date.now() + Math.min(60000, 5000 * 2 ** Math.min(++failures, 4));
    }).finally(() => { loading = false; });
    };
    void load(); const timer = window.setInterval(load, 5000);
    const changed = () => void load(); window.addEventListener('chat-feature-changed', changed);
    return () => { live = false; clearInterval(timer); window.removeEventListener('chat-feature-changed', changed); };
  }, [endpoint]);
  const matches = (id: string, opened: Opened | null) =>
    (search === '' || `${opened?.text ?? ''} ${(opened?.attachments ?? []).map(a => a.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    && (filter === 'all' || features?.marks.some(m => m.messageId === id && m.kind === filter && (filter !== 'star' || m.mine)) === true);
  return { features, loadError, search, setSearch, filter, setFilter, refresh, matches };
}

/** 0062 — die gemeinsamen Einstellungen aller Rozmowy, aus dem Menü ⋮ der Liste. */
export function CommonPreferencesDialog({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState<Preferences | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void call<{ settings: Preferences }>('/workspace/chat-preferences').then(r => setValue(r.settings)).catch(e => setError(String(e.message))); }, []);
  return <Modal title="Moja dostępność i powiadomienia" onClose={onClose}>
    <p className="wk-hint">Ustawienia wspólne wszystkich rozmów. Pojedyncza rozmowa może mieć własne — w jej menu ⋮.</p>
    {value ? <PreferencesEditor value={value} onSave={async settings => {
      await call('/workspace/chat-preferences', { method: 'PUT', body: JSON.stringify({ settings }) }); setValue(settings ?? defaultPreferences());
    }} /> : !error && <p className="wk-hint">Wczytywanie…</p>}{error && <p role="alert">{error}</p>}</Modal>;
}
const clock = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function PreferencesEditor({ value, inherited, onSave }: { value: Preferences; inherited?: boolean; onSave: (p: Preferences | null) => Promise<void> }) {
  const [p, setP] = useState(value);
  const [status, setStatus] = useState('');
  const save = async (next: Preferences | null) => { try { await onSave(next); setStatus('Zapisano.'); } catch (e) { setStatus(e instanceof Error ? e.message : 'Nie udało się zapisać.'); } };
  return <div className="wk-chat-preferences">
    {inherited !== undefined && <p>{inherited ? 'Obowiązują ustawienia wspólne.' : 'Własne ustawienia tej rozmowy.'}</p>}
    <label><input type="checkbox" checked={p.useAvailability} onChange={e => setP({ ...p, useAvailability: e.target.checked })} /> Powiadamiaj tylko w godzinach dostępności</label>
    <label>Strefa czasowa <input value={p.timeZone} onChange={e => setP({ ...p, timeZone: e.target.value })} /></label>
    {p.useAvailability && <><p className="wk-hint">Poza tymi godzinami powiadomienia są ciche. Nocny przedział podziel na dwa dni.</p>
      {(p.windows ?? []).map((w, i) => <div className="wk-actions" key={i}>
        <select aria-label="Dzień tygodnia" value={w.day} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, day: Number(e.target.value) } : v) })}>
          {['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'].map((d, n) => <option key={n} value={n}>{d}</option>)}
        </select>
        <input type="time" aria-label="Od" value={clock(w.start)} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, start: minutes(e.target.value) } : v) })} />
        <input type="time" aria-label="Do" value={clock(w.end === 1440 ? 1439 : w.end)} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, end: minutes(e.target.value) } : v) })} />
        <button type="button" onClick={() => setP({ ...p, windows: p.windows!.filter((_, j) => j !== i) })}>Usuń</button>
      </div>)}
      <button type="button" onClick={() => setP({ ...p, windows: [...(p.windows ?? []), { day: 1, start: 540, end: 1020 }] })}>Dodaj godziny</button></>}
    <label><input type="checkbox" checked={p.muted} onChange={e => setP({ ...p, muted: e.target.checked })} /> Wycisz powiadomienia</label>
    {inherited !== undefined && <label><input type="checkbox" checked={p.archived} onChange={e => setP({ ...p, archived: e.target.checked })} /> Archiwizuj rozmowę</label>}
    <label><input type="checkbox" checked={p.readReceipts} onChange={e => setP({ ...p, readReceipts: e.target.checked })} /> Udostępniaj potwierdzenia odczytania</label>
    <label><input type="checkbox" checked={p.shareAvailability ?? false} onChange={e => setP({ ...p, shareAvailability: e.target.checked })} /> Pokazuj uczestnikom, czy jestem w godzinach dostępności</label>
    {notices.available && <button type="button" onClick={() => void notices.ask().then(ok => setStatus(ok ? 'Powiadomienia włączone, gdy aplikacja jest otwarta.' : 'Powiadomienia nie są włączone.'))}>Włącz powiadomienia</button>}
    <button type="button" onClick={() => void save(p)}>Zapisz</button>
    {inherited !== undefined && <button type="button" onClick={() => void save(null)}>Przywróć wspólne ustawienia</button>}
    <p role="status">{status}</p>
  </div>;
}

/** Eine Nachricht in eine andere Rozmowa — die Anhänge werden dafür neu verschlüsselt. */
export function ForwardDialog({ endpoint, opened, ring, onClose }: { endpoint: string; opened: Opened; ring: Ring; onClose: () => void }) {
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [target, setTarget] = useState('');
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [as, setAs] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; void loadChats().then(r => { if (live) setChats(r.chats); }).catch(e => setError(String(e.message))); return () => { live = false; }; }, []);
  useEffect(() => {
    setDetail(null); setAs(''); if (!target) return;
    let live = true;
    void (async () => { const d = await loadChat(target); const n = await openNames(await areaKeys(ring, d.areaId), d.areaId, d.names);
      if (live) { setDetail(d); setNames(n); setAs(d.writers.find(id => ring.maySign(id)) ?? ''); }
    })().catch(e => setError(String(e.message)));
    return () => { live = false; };
  }, [target, ring]);
  useEffect(() => { if (!done) return; const t = window.setTimeout(onClose, 900); return () => window.clearTimeout(t); }, [done, onClose]);
  const send = async () => {
    if (!detail || !as || busy) return; setBusy(true); setError('');
    try {
      const dest = chatEndpoint(target); const attachments: Attachment[] = [];
      for (const a of opened.attachments ?? []) {
        const blob = await downloadAttachment(endpoint, a);
        attachments.push(await uploadAttachment(dest, new File([blob], a.name, { type: a.type })));
      }
      const keys = await chatKeysOf(target, await areaKeys(ring, detail.areaId, true));
      await sendMessage(ring, target, keys, as, opened.text, names.get(as) ?? null, { attachments, forwarded: true });
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się przekazać.'); } finally { setBusy(false); }
  };
  const label = (c: ChatRow) => c.kind === 'self' ? 'Notatki' : `${c.areaName} · ${c.kind === 'direct' ? 'we dwoje' : c.kind === 'group' ? 'grupa' : 'obszar'}`;
  return <Modal title="Przekaż wiadomość" onClose={onClose}>
    <blockquote className="ch-forward-quote">{opened.text || `Załączniki: ${(opened.attachments ?? []).length}`}</blockquote>
    <label className="wk-field"><span>Do rozmowy</span><select disabled={busy || done} value={target} onChange={e => setTarget(e.target.value)}><option value="">Wybierz…</option>
      {chats.filter(c => chatEndpoint(c.chatId) !== endpoint).map(c => <option key={c.chatId} value={c.chatId}>{label(c)}</option>)}
    </select></label>
    {detail && <label className="wk-field"><span>Jako</span><select disabled={busy || done} value={as} onChange={e => setAs(e.target.value)}>
      {detail.writers.filter(id => ring.maySign(id)).map(id => <option key={id} value={id}>{names.get(id) ?? id}</option>)}
    </select></label>}
    {detail && !detail.writers.some(id => ring.maySign(id)) && <p className="wk-hint">W tej rozmowie tylko czytasz.</p>}
    <div className="wk-actions">
      <button type="button" className="wk-btn" disabled={busy || done || !as} onClick={() => void send()}>{done ? 'Przekazano' : busy ? 'Przekazywanie…' : 'Przekaż'}</button>
      <button type="button" className="wk-link-btn" disabled={busy} onClick={onClose}>Anuluj</button>
    </div>
    {done && <p className="wk-done" role="status">Przekazano.</p>}
    {error && <p className="wk-error" role="alert">{error}</p>}
  </Modal>;
}
