import { useEffect, useRef, useState } from 'react';
import { areaKeys, chatKeysOf, loadChat, loadChats, openNames, sendMessage, openMessage, type ChatDetail, type ChatRow, type SealedMessage, type Attachment, type Opened, type SendOptions } from './chat';
import { availableNow, defaultPreferences, downloadAttachment, uploadAttachment, type Features, type Preferences } from './chatFeatures';
import { call } from './session';
import type { Ring } from './keys';
import { chatEndpoint } from './chatFeatures';

export function useChatExtras(endpoint: string) {
  const [features, setFeatures] = useState<Features | null>(null);
  const [search, setSearch] = useState('');
  const lastMessage = useRef<string | null | undefined>(undefined);
  const [filter, setFilter] = useState('all');
  const refresh = () => call<Features>(`${endpoint}/features`).then(setFeatures);
  useEffect(() => {
    let live = true;
    const load = () => call<Features>(`${endpoint}/features`).then(f => { if (live) {
      if (lastMessage.current !== undefined && f.lastMessageAt !== lastMessage.current && f.lastMessageAt
        && document.visibilityState !== 'visible' && !f.effective.muted && !f.effective.archived && availableNow(f.effective)
        && 'Notification' in window && Notification.permission === 'granted') new Notification('Nowa wiadomość', { body: 'W rozmowie pojawiła się wiadomość.', tag: endpoint });
      lastMessage.current = f.lastMessageAt; setFeatures(f);
    } }).catch(() => undefined);
    void load(); const timer = window.setInterval(load, 5000);
    const changed = () => void load(); window.addEventListener('chat-feature-changed', changed);
    return () => { live = false; clearInterval(timer); window.removeEventListener('chat-feature-changed', changed); };
  }, [endpoint]);
  const matches = (id: string, opened: Opened | null) =>
    (search === '' || `${opened?.text ?? ''} ${(opened?.attachments ?? []).map(a => a.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    && (filter === 'all' || features?.marks.some(m => m.messageId === id && m.kind === filter && (filter !== 'star' || m.mine)));
  return { features, search, setSearch, filter, setFilter, refresh, matches };
}
export function ChatToolbar({ endpoint, extras, keys, canModerate = false, onPolicy }: {
  endpoint: string; extras: ReturnType<typeof useChatExtras>; keys: ReadonlyMap<number, Uint8Array>; canModerate?: boolean; onPolicy?: () => void;
}) {
  const [settings, setSettings] = useState(false);
  const [scheduled, setScheduled] = useState<(SealedMessage & { sendAt: string; state: string; preview: string })[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const load = () => call<{ messages: typeof scheduled }>(`${endpoint}/scheduled`).then(async r => { const opened = await Promise.all(r.messages.map(async m => ({ ...m, preview: (await openMessage(keys, m))?.text ?? 'Załącznik lub wiadomość bez dostępnego klucza' }))); if (live) setScheduled(opened); }).catch(() => undefined);
    void load(); const timer = setInterval(load, 5000); return () => { live = false; clearInterval(timer); };
  }, [endpoint, keys]);
  const f = extras.features;
  return <section className="wk-chat-extras">
    <div className="wk-actions">
      <input aria-label="Szukaj we wczytanych wiadomościach" placeholder="Szukaj we wczytanych wiadomościach…" value={extras.search} onChange={e => extras.setSearch(e.target.value)} />
      <select aria-label="Filtr wiadomości" value={extras.filter} onChange={e => extras.setFilter(e.target.value)}>
        <option value="all">Wszystkie</option><option value="star">Zapisane</option><option value="pin">Przypięte</option>
      </select>
      <button type="button" onClick={() => setSettings(!settings)}>Dostępność i powiadomienia</button>
    </div>
    {f?.receipts.some(r => r.available !== null) && <p className="wk-hint">Dostępni uczestnicy: {f.receipts.filter(r => r.available === true).length} · poza godzinami: {f.receipts.filter(r => r.available === false).length}</p>}
    {f?.typing ? <p role="status">Ktoś pisze…</p> : null}
    {f?.postingPolicy === 'writers' && <p className="wk-hint">Kanał — publikują osoby z prawem zapisu w obszarze.</p>}
    {f && (!availableNow(f.effective) || f.effective.muted) && <p className="wk-hint">Tryb cichy. Wiadomości nadal docierają.</p>}
    {settings && f && <PreferencesEditor key={endpoint} value={f.settings ?? f.common} inherited={f.settings === null}
      onSave={async p => { await call(`${endpoint}/preferences`, { method: 'PUT', body: JSON.stringify({ settings: p }) }); await extras.refresh(); }} />}
    {settings && canModerate && f && <label className="wk-field">Kto może pisać
      <select value={f.postingPolicy} onChange={e => {
        void call(`${endpoint}/policy`, { method: 'PUT', body: JSON.stringify({ postingPolicy: e.target.value }) })
          .then(() => { void extras.refresh(); onPolicy?.(); }).catch(e => setError(String(e.message)));
      }}><option value="legacy">Dotychczasowe zasady</option><option value="members">Wszyscy uczestnicy</option><option value="writers">Kanał: tylko prawo write/admin</option></select>
    </label>}
    {scheduled.length > 0 && <details><summary>Zaplanowane ({scheduled.length})</summary>{scheduled.map(m => <p key={m.messageId}>
      <strong>{m.preview || 'Załącznik'}</strong><br />{new Date(m.sendAt).toLocaleString()} — {m.state === 'failed' ? 'Niewysłana: zmienił się dostęp lub klucz. Anuluj i zaplanuj ponownie.' : 'Oczekuje'}{' '}
      {m.state === 'pending' && <ScheduleTime endpoint={endpoint} messageId={m.messageId} sendAt={m.sendAt} onError={setError} />}
      <button type="button" onClick={() => void call(`${endpoint}/scheduled/${m.messageId}`, { method: 'DELETE' })
        .then(() => setScheduled(s => s.filter(x => x.messageId !== m.messageId))).catch(e => setError(String(e.message)))}>Anuluj</button>
    </p>)}</details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
function ScheduleTime({ endpoint, messageId, sendAt, onError }: { endpoint: string; messageId: string; sendAt: string; onError: (s: string) => void }) {
  const date = new Date(sendAt);
  const [value, setValue] = useState(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  return <span><input type="datetime-local" aria-label="Nowy termin wysyłki" value={value} onChange={e => setValue(e.target.value)} />
    <button type="button" onClick={() => {
      if (!value || new Date(value).getTime() <= Date.now()) { onError('Wybierz przyszły termin.'); return; }
      void call(`${endpoint}/scheduled/${messageId}`, { method: 'PUT', body: JSON.stringify({ sendAt: new Date(value).toISOString() }) })
        .then(() => onError('Zmieniono termin.')).catch(e => onError(String(e.message)));
    }}>Zmień termin</button></span>;
}
export function CommonChatPreferences() {
  const [value, setValue] = useState<Preferences | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void call<{ settings: Preferences }>('/workspace/chat-preferences').then(r => setValue(r.settings)).catch(e => setError(String(e.message))); }, []);
  return <details className="wk-chat-extras"><summary>Moja dostępność — ustawienia wspólne rozmów</summary>
    {value && <PreferencesEditor value={value} onSave={async settings => {
      await call('/workspace/chat-preferences', { method: 'PUT', body: JSON.stringify({ settings }) }); setValue(settings ?? defaultPreferences());
    }} />}{error && <p role="alert">{error}</p>}</details>;
}
const clock = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
function PreferencesEditor({ value, inherited, onSave }: { value: Preferences; inherited?: boolean; onSave: (p: Preferences | null) => Promise<void> }) {
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
    {'Notification' in window && <button type="button" onClick={() => void Notification.requestPermission().then(result => setStatus(result === 'granted' ? 'Powiadomienia włączone, gdy aplikacja jest otwarta.' : 'Powiadomienia przeglądarki nie są włączone.'))}>Włącz powiadomienia przeglądarki</button>}
    <button type="button" onClick={() => void save(p)}>Zapisz</button>
    {inherited !== undefined && <button type="button" onClick={() => void save(null)}>Przywróć wspólne ustawienia</button>}
    <p role="status">{status}</p>
  </div>;
}
export function useComposerExtras(endpoint: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [sendAt, setSendAt] = useState('');
  const [reply, setReply] = useState<{ replyTo: string; replyText: string } | null>(null);
  const [notice, setNotice] = useState('');
  const lastTyping = useRef(0);
  useEffect(() => {
    const receive = (e: Event) => { const d = (e as CustomEvent).detail; if (d.endpoint === endpoint) setReply({ replyTo: d.id, replyText: d.text.slice(0, 500) }); };
    window.addEventListener('chat-reply', receive); return () => window.removeEventListener('chat-reply', receive);
  }, [endpoint]);
  const typing = () => { if (Date.now() - lastTyping.current < 4000) return; lastTyping.current = Date.now(); void call(`${endpoint}/typing`, { method: 'POST' }).catch(() => undefined); };
  const prepare = async (): Promise<SendOptions> => {
    if (sendAt && new Date(sendAt).getTime() <= Date.now()) throw new Error('Wybierz przyszły termin.');
    const attachments: Attachment[] = [];
    for (const file of files) attachments.push(await uploadAttachment(endpoint, file));
    return { attachments, ...reply, ...(sendAt ? { sendAt: new Date(sendAt).toISOString() } : {}) };
  };
  const done = () => { setNotice(sendAt ? 'Wiadomość zaplanowana.' : ''); setFiles([]); setReply(null); setSendAt(''); };
  return { files, setFiles, sendAt, setSendAt, reply, setReply, notice, prepare, done, typing };
}
export function ComposerExtras({ state, busy }: { state: ReturnType<typeof useComposerExtras>; busy: boolean }) {
  return <div className="wk-chat-extras">
    {state.reply && <blockquote>Odpowiedź: {state.reply.replyText} <button type="button" onClick={() => state.setReply(null)}>×</button></blockquote>}
    <VoiceRecorder disabled={busy || state.files.length >= 8} onRecorded={file => state.setFiles(was => [...was, file].slice(0, 8))} />
    <label>Pliki, zdjęcia, muzyka <input type="file" multiple disabled={busy} onChange={e => { state.setFiles(Array.from(e.target.files ?? []).slice(0, 8)); e.target.value = ''; }} /></label>
    {state.files.map((f, i) => <span key={i} className="wk-tag">{f.name} <button type="button" disabled={busy} onClick={() => state.setFiles(state.files.filter((_, j) => j !== i))}>×</button></span>)}
    <label>Wyślij później <input type="datetime-local" value={state.sendAt} disabled={busy} onChange={e => state.setSendAt(e.target.value)} /></label>
    {state.sendAt && <button type="button" onClick={() => state.setSendAt('')}>Wyślij teraz</button>}
    {state.notice && <p role="status">{state.notice}</p>}
  </div>;
}
export function MessageContent({ endpoint, id, opened, features, sentAt, ring, canModerate = false }: {
  endpoint: string; id: string; opened: Opened; features: Features | null; sentAt: string; ring?: Ring; canModerate?: boolean;
}) {
  const [error, setError] = useState('');
  const [forward, setForward] = useState(false);
  const marks = features?.marks.filter(m => m.messageId === id) ?? [];
  const mark = (kind: string, value: string) => void call(`${endpoint}/marks`, { method: 'POST', body: JSON.stringify({ messageId: id, kind,
    value: marks.some(m => (m.mine || kind === 'pin') && m.kind === kind && m.value === value) ? null : value }) })
    .then(() => window.dispatchEvent(new Event('chat-feature-changed'))).catch(e => setError(String(e.message)));
  return <>
    {opened.replyTo && <blockquote><a href={`#message-${opened.replyTo}`} onClick={e => { e.preventDefault(); document.getElementById(`message-${opened.replyTo}`)?.scrollIntoView({ block: 'center' }); }}>{opened.replyText ?? 'Odpowiedź'}</a></blockquote>}
    {opened.forwarded && <small className="wk-hint">Przekazana wiadomość<br /></small>}
    {opened.text}
    {marks.some(m => m.kind === 'pin') && <span className="wk-tag">📌 Przypięta</span>}
    {features?.receipts.some(r => r.readAt !== null && new Date(r.readAt).getTime() >= new Date(sentAt).getTime()) && <small className="wk-hint"> · Przeczytana przez {features.receipts.filter(r => r.readAt !== null && new Date(r.readAt).getTime() >= new Date(sentAt).getTime()).length}</small>}
    {(opened.attachments ?? []).map(a => <AttachmentView key={a.id} endpoint={endpoint} attachment={a} />)}
    <div className="wk-msg-extras">
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('chat-reply', { detail: { endpoint, id, text: opened.text } }))}>Odpowiedz</button>
      {ring && <button type="button" onClick={() => setForward(true)}>Przekaż</button>}
      <button type="button" onClick={() => mark('star', '1')}>{marks.some(m => m.mine && m.kind === 'star') ? '★ Zapisana' : '☆ Zapisz'}</button>
      {canModerate && <button type="button" onClick={() => mark('pin', '1')}>📌 {marks.some(m => m.kind === 'pin') ? 'Odepnij' : 'Przypnij'}</button>}
      {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => <button type="button" key={emoji} aria-label={`Reakcja ${emoji}`} aria-pressed={marks.some(m => m.mine && m.value === emoji)} onClick={() => mark('reaction', emoji)}>{emoji} {marks.filter(m => m.kind === 'reaction' && m.value === emoji).length || ''}</button>)}
    </div>{forward && ring && <ForwardMessage endpoint={endpoint} opened={opened} ring={ring} onClose={() => setForward(false)} />}{error && <p role="alert">{error}</p>}
  </>;
}
function AttachmentView({ endpoint, attachment }: { endpoint: string; attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => { setBusy(true); try { setUrl(URL.createObjectURL(await downloadAttachment(endpoint, attachment))); } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się pobrać.'); } finally { setBusy(false); } };
  const image = /^image\/(png|jpeg|gif|webp|avif)$/.test(attachment.type);
  return <div className="wk-chat-attachment">
    {!url ? <button type="button" disabled={busy} onClick={() => void load()}>{busy ? 'Otwieranie…' : `Otwórz ${attachment.name}`} ({Math.ceil(attachment.size / 1024)} KB)</button> : <>
      {image && <img src={url} alt={attachment.name} loading="lazy" />}
      {attachment.type.startsWith('audio/') && <audio controls src={url} />}
      {attachment.type.startsWith('video/') && <video controls src={url} />}
      <a href={url} download={attachment.name}>{attachment.name} — pobierz</a>
    </>}{error && <p role="alert">{error}</p>}
  </div>;
}

function ForwardMessage({ endpoint, opened, ring, onClose }: { endpoint: string; opened: Opened; ring: Ring; onClose: () => void }) {
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [target, setTarget] = useState('');
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [as, setAs] = useState('');
  const [busy, setBusy] = useState(false);
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
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się przekazać.'); } finally { setBusy(false); }
  };
  return <section className="wk-chat-preferences" role="region" aria-label="Przekaż wiadomość">
    <label>Do rozmowy <select disabled={busy} value={target} onChange={e => setTarget(e.target.value)}><option value="">Wybierz…</option>
      {chats.map(c => <option key={c.chatId} value={c.chatId}>{c.areaName} · {c.chatId.slice(0, 8)}</option>)}
    </select></label>
    {detail && <label>Jako <select disabled={busy} value={as} onChange={e => setAs(e.target.value)}>
      {detail.writers.filter(id => ring.maySign(id)).map(id => <option key={id} value={id}>{names.get(id) ?? id}</option>)}
    </select></label>}
    <button type="button" disabled={busy || !as} onClick={() => void send()}>{busy ? 'Przekazywanie…' : 'Przekaż wiadomość'}</button>
    <button type="button" disabled={busy} onClick={onClose}>Anuluj</button>{error && <p role="alert">{error}</p>}
  </section>;
}
function VoiceRecorder({ disabled, onRecorded }: { disabled: boolean; onRecorded: (file: File) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  const [recording, setRecording] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { live.current = true; return () => {
    live.current = false; if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
  }; }, []);
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null;
  const start = async () => {
    setAsking(true); setError('');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current) { mic.getTracks().forEach(t => t.stop()); return; }
      stream.current = mic; const rec = new MediaRecorder(mic); recorder.current = rec; const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        mic.getTracks().forEach(t => t.stop());
        if (!live.current) return;
        setRecording(false); const type = rec.mimeType || chunks[0]?.type || 'audio/webm';
        onRecorded(new File(chunks, `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
      };
      rec.start(); setRecording(true); timer.current = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 300000);
    } catch (e) { stream.current?.getTracks().forEach(t => t.stop()); setError(e instanceof Error ? e.message : 'Mikrofon jest niedostępny.'); }
    finally { if (live.current) setAsking(false); }
  };
  return <span><button type="button" disabled={disabled || asking} onClick={() => recording ? recorder.current?.stop() : void start()}>
    {recording ? 'Zakończ nagrywanie' : asking ? 'Otwieranie mikrofonu…' : 'Nagraj wiadomość głosową'}</button>
    {recording && <span role="status"> Nagrywanie — maksymalnie 5 minut</span>}{error && <span role="alert">{error}</span>}
  </span>;
}
