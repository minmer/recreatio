import { useEffect, useRef, useState } from 'react';
import { areaKeys, chatKeysOf, loadChat, loadChats, openNames, sendMessage, type ChatDetail, type ChatRow, type Attachment, type Opened } from './chat';
import { availableNow, defaultPreferences, downloadAttachment, uploadAttachment, type Features, type Preferences } from './chatFeatures';
import { Modal } from '../ui/Modal';
import { notices } from '../core/platform';
import { call, whoIsThere } from '../core/session';
import type { Ring } from '../core/keys';
import { speakerKey, speakersOf, speakerText, throughRole, type GraphLike, type Speaker } from './chatAuthor';
import { keysFor } from '../core/ringOf';
import { myRoleNames } from '../roles/roleNames';
import { chatEndpoint } from './chatFeatures';
import { fmtDate, useT } from '../core/i18n';

/**
 * `notify`: selbst melden, wenn die Seite verdeckt ist. Im Arbeitsplatz nicht
 * (0076) — dort meldet `notify.ts` jede Rozmowa, in der App mit Inhalt und
 * Antwortfeld; eine zweite Meldung daneben wäre doppelt. Auf einer Seite und
 * für den Menschen mit Link (ohne Konto, ohne Glocke) bleibt es hier.
 */
export function useChatExtras(endpoint: string, { notify = true }: { notify?: boolean } = {}) {
  const t = useT();
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
        notices.show({ title: t('chat.extras.newTitle'), body: t('chat.extras.newBody'), tag: endpoint });
      lastMessage.current = f.lastMessageAt; setFeatures(f); setLoadError(null); failures = 0;
    } }).catch(e => {
      if (live) setLoadError(e instanceof Error ? e.message : t('chat.extras.loadFailed'));
      retryAt = Date.now() + Math.min(60000, 5000 * 2 ** Math.min(++failures, 4));
    }).finally(() => { loading = false; });
    };
    void load(); const timer = window.setInterval(load, 5000);
    const changed = () => void load(); window.addEventListener('chat-feature-changed', changed);
    return () => { live = false; clearInterval(timer); window.removeEventListener('chat-feature-changed', changed); };
  }, [endpoint, t]);
  const matches = (id: string, opened: Opened | null) =>
    (search === '' || `${opened?.text ?? ''} ${(opened?.attachments ?? []).map(a => a.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    && (filter === 'all' || features?.marks.some(m => m.messageId === id && m.kind === filter && (filter !== 'star' || m.mine)) === true);
  return { features, loadError, search, setSearch, filter, setFilter, refresh, matches };
}

/** 0062 — die gemeinsamen Einstellungen aller Rozmowy, aus dem Menü ⋮ der Liste. */
export function CommonPreferencesDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState<Preferences | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void call<{ settings: Preferences }>('/workspace/chat-preferences').then(r => setValue(r.settings)).catch(e => setError(String(e.message))); }, []);
  return <Modal title={t('chat.prefs.commonTitle')} onClose={onClose}>
    <p className="wk-hint">{t('chat.prefs.commonHint')}</p>
    {value ? <PreferencesEditor value={value} onSave={async settings => {
      await call('/workspace/chat-preferences', { method: 'PUT', body: JSON.stringify({ settings }) }); setValue(settings ?? defaultPreferences());
    }} /> : !error && <p className="wk-hint">{t('common.loading')}</p>}{error && <p role="alert">{error}</p>}</Modal>;
}
const clock = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function PreferencesEditor({ value, inherited, onSave }: { value: Preferences; inherited?: boolean; onSave: (p: Preferences | null) => Promise<void> }) {
  const t = useT();
  const [p, setP] = useState(value);
  const [status, setStatus] = useState('');
  const save = async (next: Preferences | null) => { try { await onSave(next); setStatus(t('chat.prefs.saved')); } catch (e) { setStatus(e instanceof Error ? e.message : t('chat.prefs.saveFailed')); } };
  return <div className="wk-chat-preferences">
    {inherited !== undefined && <p>{inherited ? t('chat.prefs.inherited') : t('chat.prefs.own')}</p>}
    <label><input type="checkbox" checked={p.useAvailability} onChange={e => setP({ ...p, useAvailability: e.target.checked })} /> {t('chat.prefs.useAvailability')}</label>
    <label>{t('chat.prefs.timeZone')} <input value={p.timeZone} onChange={e => setP({ ...p, timeZone: e.target.value })} /></label>
    {p.useAvailability && <><p className="wk-hint">{t('chat.prefs.windowsHint')}</p>
      {(p.windows ?? []).map((w, i) => <div className="wk-actions" key={i}>
        <select aria-label={t('chat.prefs.weekday')} value={w.day} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, day: Number(e.target.value) } : v) })}>
          {[0, 1, 2, 3, 4, 5, 6].map((n) => { const d = fmtDate(new Date(2023, 0, 1 + n), { weekday: 'long' }, t.lang); return <option key={n} value={n}>{d.charAt(0).toLocaleUpperCase(t.locale) + d.slice(1)}</option>; })}
        </select>
        <input type="time" aria-label={t('common.from')} value={clock(w.start)} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, start: minutes(e.target.value) } : v) })} />
        <input type="time" aria-label={t('common.to')} value={clock(w.end === 1440 ? 1439 : w.end)} onChange={e => setP({ ...p, windows: p.windows!.map((v, j) => j === i ? { ...v, end: minutes(e.target.value) } : v) })} />
        <button type="button" onClick={() => setP({ ...p, windows: p.windows!.filter((_, j) => j !== i) })}>{t('common.remove')}</button>
      </div>)}
      <button type="button" onClick={() => setP({ ...p, windows: [...(p.windows ?? []), { day: 1, start: 540, end: 1020 }] })}>{t('chat.prefs.addHours')}</button></>}
    <label><input type="checkbox" checked={p.muted} onChange={e => setP({ ...p, muted: e.target.checked })} /> {t('chat.prefs.mute')}</label>
    {inherited !== undefined && <label><input type="checkbox" checked={p.archived} onChange={e => setP({ ...p, archived: e.target.checked })} /> {t('chat.prefs.archive')}</label>}
    <label><input type="checkbox" checked={p.readReceipts} onChange={e => setP({ ...p, readReceipts: e.target.checked })} /> {t('chat.prefs.readReceipts')}</label>
    <label><input type="checkbox" checked={p.shareAvailability ?? false} onChange={e => setP({ ...p, shareAvailability: e.target.checked })} /> {t('chat.prefs.shareAvailability')}</label>
    {/* 0111 — wie „ostatnio widziany" in jedem Messenger, aber nur, wenn man es selbst will. */}
    <label><input type="checkbox" checked={p.shareOnline ?? false} onChange={e => setP({ ...p, shareOnline: e.target.checked })} /> {t('chat.prefs.shareOnline')}</label>
    {p.shareOnline === true && <p className="wk-hint">{t('chat.prefs.shareOnlineHint')}</p>}
    {notices.available && <button type="button" onClick={() => void notices.ask().then(ok => setStatus(ok ? t('chat.prefs.noticesOn') : t('chat.prefs.noticesOff')))}>{t('chat.prefs.enableNotices')}</button>}
    <button type="button" onClick={() => void save(p)}>{t('common.save')}</button>
    {inherited !== undefined && <button type="button" onClick={() => void save(null)}>{t('chat.prefs.restore')}</button>}
    <p role="status">{status}</p>
  </div>;
}

/** Eine Nachricht in eine andere Rozmowa — die Anhänge werden dafür neu verschlüsselt. */
export function ForwardDialog({ endpoint, opened, ring, onClose }: { endpoint: string; opened: Opened; ring: Ring; onClose: () => void }) {
  const t = useT();
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [target, setTarget] = useState('');
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [as, setAs] = useState('');
  /* 0095 — als wer: eine Rolle der Ziel-Rozmowa und eine eigene Person, die sie hält. */
  const [graph, setGraph] = useState<GraphLike | null>(null);
  const [own, setOwn] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; void loadChats().then(r => { if (live) setChats(r.chats); }).catch(e => setError(String(e.message))); return () => { live = false; }; }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      const who = await whoIsThere();
      if (who === null) return;
      const [found, names] = await Promise.all([keysFor(who), myRoleNames(who)]);
      if (!live) return;
      setGraph({ roles: found.graph.roles.filter(r => r.kind !== 'account' && ring.has(r.id)), edges: found.graph.edges });
      setOwn(names);
    })().catch(() => undefined);
    return () => { live = false; };
  }, [ring]);
  const speakers: Speaker[] = detail && graph ? speakersOf(detail.writers, graph, id => ring.maySign(id)) : [];
  const speaker = speakers.find(one => speakerKey(one) === as) ?? speakers[0] ?? null;
  const known = (id: string) => names.get(id) ?? own.get(id) ?? null;
  useEffect(() => {
    setDetail(null); setAs(''); if (!target) return;
    let live = true;
    void (async () => { const d = await loadChat(target); const n = await openNames(await areaKeys(ring, d.areaId), d.areaId, d.names);
      if (live) { setDetail(d); setNames(n); setAs(''); }
    })().catch(e => setError(String(e.message)));
    return () => { live = false; };
  }, [target, ring]);
  useEffect(() => { if (!done) return; const timer = window.setTimeout(onClose, 900); return () => window.clearTimeout(timer); }, [done, onClose]);
  const send = async () => {
    if (!detail || !speaker || busy) return; setBusy(true); setError('');
    try {
      const dest = chatEndpoint(target); const attachments: Attachment[] = [];
      for (const a of opened.attachments ?? []) {
        const blob = await downloadAttachment(endpoint, a);
        attachments.push(await uploadAttachment(dest, new File([blob], a.name, { type: a.type })));
      }
      const keys = await chatKeysOf(target, await areaKeys(ring, detail.areaId, true));
      await sendMessage(ring, target, keys, speaker.roleId, opened.text, known(speaker.personId), {
        attachments, forwarded: true, personId: speaker.personId, via: throughRole(speaker) ? known(speaker.roleId) : null
      });
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : t('chat.forward.failed')); } finally { setBusy(false); }
  };
  const label = (c: ChatRow) => c.kind === 'self' ? t('chat.title.notes') : `${c.areaName} · ${t(c.kind === 'direct' ? 'chat.forward.kindDirect' : c.kind === 'group' ? 'chat.forward.kindGroup' : 'chat.forward.kindArea')}`;
  return <Modal title={t('chat.forward.title')} onClose={onClose}>
    <blockquote className="ch-forward-quote">{opened.text || t('chat.forward.attachments', { count: (opened.attachments ?? []).length })}</blockquote>
    <label className="wk-field"><span>{t('chat.forward.to')}</span><select disabled={busy || done} value={target} onChange={e => setTarget(e.target.value)}><option value="">{t('common.choose')}</option>
      {chats.filter(c => chatEndpoint(c.chatId) !== endpoint).map(c => <option key={c.chatId} value={c.chatId}>{label(c)}</option>)}
    </select></label>
    {detail && speakers.length > 1 && <label className="wk-field"><span>{t('chat.forward.as')}</span><select disabled={busy || done} value={speaker === null ? '' : speakerKey(speaker)} onChange={e => setAs(e.target.value)}>
      {speakers.map(one => <option key={speakerKey(one)} value={speakerKey(one)}>{speakerText(one, known)}</option>)}
    </select></label>}
    {detail && graph && speakers.length === 0 && <p className="wk-hint">{detail.writers.some(id => ring.maySign(id)) ? t('chat.forward.needPerson') : t('chat.forward.readOnly')}</p>}
    <div className="wk-actions">
      <button type="button" className="wk-btn" disabled={busy || done || !speaker} onClick={() => void send()}>{done ? t('chat.forward.doneShort') : busy ? t('chat.forward.busy') : t('chat.forward.send')}</button>
      <button type="button" className="wk-link-btn" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    </div>
    {done && <p className="wk-done" role="status">{t('chat.forward.done')}</p>}
    {error && <p className="wk-error" role="alert">{error}</p>}
  </Modal>;
}
