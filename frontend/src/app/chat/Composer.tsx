/**
 * Das Feld unten: Emoji, 📎, Mikrofon oder Senden; Antworten, Bearbeiten, Planen, Senden als.
 */

import { type CSSProperties, type ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

import { useT } from '../core/i18n';
import { call } from '../core/session';
import { Modal } from '../ui/Modal';
import type { Attachment, SendOptions } from './chat';
import { photoForChat, uploadAttachment } from './chatFeatures';
import { Icon, PopMenu, cls, coarsePointer, failure, hueOf, localInput, sizeOf, whenLong } from './ChatKit';

/* -- Das Feld ---------------------------------------------------------------------------- */

export interface ReplyTarget {
  readonly id: string;
  readonly text: string;
  readonly author: string;
}

export interface EditTarget {
  readonly id: string;
  readonly text: string;
}

/** 0100 — eine Nachricht im Ausgang: wartet, geht gerade hinaus, oder ging nicht. */
interface Outgoing {
  readonly id: string;
  readonly body: string;
  readonly files: readonly File[];
  readonly reply: ReplyTarget | null;
  readonly how: Sending;
  readonly state: 'waiting' | 'sending' | 'failed';
  readonly note: string | null;
  readonly error: string | null;
}

export interface ComposerHandle {
  addFiles: (files: readonly File[]) => void;
  focus: () => void;
}

/** 0111 — wie eine Nachricht hinausgeht: jetzt, zu einer Zeit, wenn jemand online ist — und ob mit Klang. */
interface Sending {
  readonly sendAt?: string;
  readonly whenOnline?: boolean;
  readonly silent?: boolean;
}

const EMOJI = [
  '😀', '😂', '🥲', '😊', '😍', '🥰', '😘', '😉', '😎', '🤔', '😮', '😢', '😭', '😡', '🙄', '😴',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👋', '🤝', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🔥',
  '✨', '🎉', '🎂', '🌹', '☀️', '⛪', '✝️', '🕯️', '📖', '✅', '❌', '❓', '❗', '👀', '💡', '📌'
];

/** Das Mikrofon — Aufnahme, Zeit, verwerfen oder senden. Höchstens fünf Minuten. */
function useRecorder(onOverflow: (file: File) => void) {
  const t = useT();
  const supported = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined && typeof MediaRecorder !== 'undefined';
  const [state, setState] = useState<'idle' | 'asking' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const waiting = useRef<((file: File | null) => void) | null>(null);
  const keep = useRef(true);
  const tick = useRef<number | undefined>(undefined);
  const limit = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const overflow = useRef(onOverflow);
  overflow.current = onOverflow;

  const release = () => {
    window.clearInterval(tick.current);
    window.clearTimeout(limit.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      keep.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    };
  }, []);

  const start = async () => {
    if (!supported || state !== 'idle') return;
    setState('asking');
    setFailed(null);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { mic.getTracks().forEach((tr) => tr.stop()); return; }
      stream.current = mic;
      const rec = new MediaRecorder(mic);
      recorder.current = rec;
      chunks.current = [];
      keep.current = true;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        release();
        const type = rec.mimeType || chunks.current[0]?.type || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = !keep.current || chunks.current.length === 0 ? null
          : new File(chunks.current, `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, { type });
        if (alive.current) { setState('idle'); setSeconds(0); }
        const done = waiting.current;
        waiting.current = null;
        if (done !== null) done(file);
        else if (file !== null && alive.current) overflow.current(file);
      };
      rec.start(250);
      const began = Date.now();
      setSeconds(0);
      setState('recording');
      tick.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250);
      limit.current = window.setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 300_000);
    } catch (e) {
      release();
      if (alive.current) {
        setState('idle');
        setFailed(e instanceof DOMException && e.name === 'NotAllowedError' ? t('chat.compose.micDenied') : t('chat.compose.micUnavailable'));
      }
    }
  };

  const finish = (keepIt: boolean): Promise<File | null> => new Promise((resolve) => {
    const rec = recorder.current;
    if (rec === null || rec.state !== 'recording') { resolve(null); return; }
    keep.current = keepIt;
    waiting.current = resolve;
    rec.stop();
  });

  return { supported, state, seconds, failed, start, send: () => finish(true), cancel: () => { void finish(false); } };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function FileChip({ file, busy, onRemove }: { file: File; busy: boolean; onRemove: () => void }) {
  const t = useT();
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith('image/')) return undefined;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const name = file.name.startsWith('voice-') ? t('chat.compose.voiceRecording') : file.name;
  return (
    <span className="ch-file-chip">
      {thumb !== null ? <img src={thumb} alt="" /> : <span className="ch-file-ic"><Icon name={file.type.startsWith('audio/') ? 'music' : 'file'} /></span>}
      <span className="ch-file-text"><span className="ch-file-name">{name}</span><small>{sizeOf(file.size)}</small></span>
      <button type="button" className="ch-icon-btn is-small" aria-label={t('chat.compose.removeFile', { name })} disabled={busy} onClick={onRemove}><Icon name="x" /></button>
    </span>
  );
}

/** Wann eine geplante Nachricht hinausgeht — schnell gewählt oder genau. Wie in Telegram: gewählt heisst gesendet. */
function PlanDialog({ onPlan, onClose }: { onPlan: (iso: string, silent: boolean) => void; onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState(() => localInput(new Date(Date.now() + 3_600_000)));
  const [failed, setFailed] = useState<string | null>(null);
  /* 0111 — auch eine geplante kann leise hinausgehen (nachts, früh am Morgen). */
  const [silent, setSilent] = useState(false);
  const now = new Date();
  const atHour = (days: number, hour: number) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d; };
  const monday = atHour(((8 - now.getDay()) % 7) || 7, 9);
  const quick = [
    { label: t('chat.plan.inHour'), at: new Date(now.getTime() + 3_600_000) },
    ...(now.getHours() < 17 ? [{ label: t('chat.plan.today18'), at: atHour(0, 18) }] : []),
    { label: t('chat.plan.tomorrow9'), at: atHour(1, 9) },
    { label: t('chat.plan.monday9'), at: monday }
  ];

  const plan = (d: Date) => {
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now() + 30_000) { setFailed(t('chat.chrome.pickFuture')); return; }
    if (d.getTime() > Date.now() + 365 * 86_400_000) { setFailed(t('chat.plan.maxYear')); return; }
    onClose();
    onPlan(d.toISOString(), silent);
  };

  return (
    <Modal title={t('chat.plan.title')} onClose={onClose}>
      <div className="ch-plan-quick">
        {quick.map((q) => <button key={q.label} type="button" className="ch-chip" onClick={() => plan(q.at)}>{q.label}</button>)}
      </div>
      <label className="wk-field">
        <span>{t('chat.plan.exact')}</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="ch-plan-silent">
        <input type="checkbox" checked={silent} onChange={(e) => setSilent(e.target.checked)} />
        <span>{t('chat.plan.silent')}</span>
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => plan(new Date(value))}>{t('chat.plan.go')}</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
      <p className="wk-hint">{t('chat.plan.hint')}</p>
    </Modal>
  );
}

export const Composer = forwardRef<ComposerHandle, {
  endpoint: string;
  /** Warum hier nicht geschrieben wird — dann steht statt des Feldes dieser Satz. */
  readOnly?: string | null;
  placeholder?: string;
  reply: ReplyTarget | null;
  onClearReply: () => void;
  editing: EditTarget | null;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => Promise<void>;
  onSend: (text: string, options: SendOptions) => Promise<void>;
  /** Pfeil nach oben im leeren Feld: die eigene letzte bearbeiten. */
  onEditLast?: () => void;
  onScheduled?: () => void;
  /** Über dem Feld — der Name, unter dem ein Mensch mit Link schreibt; die geplanten. */
  before?: ReactNode;
  /** Links neben dem Feld — als wen (Telegram: „Wyślij jako"). */
  sendAs?: ReactNode;
  /** Gesendet werden kann gerade nicht — und das ist der Grund. */
  blocked?: string | null;
  /** 0111 — „Wyślij, gdy będzie online" im Menü des Senden-Knopfs (`useChatChrome().onlineSend`); `null`: nicht angeboten. */
  onlineSend?: string | null;
}>(function Composer({ endpoint, readOnly = null, placeholder, reply, onClearReply, editing, onCancelEdit, onSaveEdit, onSend, onEditLast, onScheduled, before, sendAs, blocked = null, onlineSend = null }, ref) {
  const t = useT();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<readonly File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pop, setPop] = useState<{ kind: 'attach' | 'emoji' | 'send'; rect: DOMRect; from: Element } | null>(null);
  const [planning, setPlanning] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  const shrinkNext = useRef(true);
  const draft = useRef('');
  const wasEditing = useRef<string | null>(null);
  const lastTyping = useRef(0);
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);

  /* Wie viele Fotos gerade verkleinert werden — so lange wartet „Wyślij". */
  const [preparing, setPreparing] = useState(0);

  /* Was schon hochgeladen ist: scheitert die Nachricht danach, lädt ein zweiter Versuch es nicht noch einmal hoch. */
  const uploaded = useRef(new WeakMap<File, Attachment>());

  /*
   * 0100 — DER AUSGANG. „Wyślij" leert das Feld SOFORT und gibt die Nachricht
   * hierher; Fotos, Filme und Aufnahmen gehen im Hintergrund hinaus, eine nach
   * der anderen (die Reihenfolge bleibt). Währenddessen schreibt man weiter —
   * vorher stand der Text bis zum Ende des Hochladens im Feld, und was man
   * inzwischen tippte, verschwand mit ihm.
   */
  const [outbox, setOutbox] = useState<readonly Outgoing[]>([]);
  const running = useRef(false);

  /**
   * Dateien ins Feld. `shrink`: Fotos so, wie sie in eine Rozmowa gehören
   * (`photoForChat`) — aus „Zdjęcia i filmy", der Kamera, dem Einfügen und
   * dem Hineinziehen. Über „Plik" kommt das Original.
   */
  const addFiles = useCallback((more: readonly File[], shrink = true) => {
    if (more.length === 0) return;
    if (!shrink) { setFiles((was) => [...was, ...more].slice(0, 8)); return; }
    setPreparing((n) => n + 1);
    void Promise.all(more.map((one) => photoForChat(one).catch(() => one)))
      .then((ready) => setFiles((was) => [...was, ...ready].slice(0, 8)))
      .finally(() => setPreparing((n) => n - 1));
  }, []);
  useEffect(() => { if (files.length >= 8) setNotice(t('chat.compose.maxFiles')); }, [files.length, t]);

  const recorder = useRecorder((file) => addFiles([file]));
  useImperativeHandle(ref, () => ({ addFiles, focus: () => area.current?.focus() }), [addFiles]);

  /* Bearbeiten: der Text der Nachricht ins Feld, der Entwurf beiseite — und danach zurück. */
  const editingId = editing?.id ?? null;
  const editingText = editing?.text ?? '';
  useEffect(() => {
    if (editingId !== null && wasEditing.current === null) draft.current = area.current?.value ?? '';
    if (editingId !== null) {
      setText(editingText);
      window.requestAnimationFrame(() => {
        const el = area.current;
        if (el !== null) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    } else if (wasEditing.current !== null) {
      setText(draft.current);
    }
    wasEditing.current = editingId;
  }, [editingId, editingText]);

  const replyId = reply?.id ?? null;
  useEffect(() => { if (replyId !== null) area.current?.focus(); }, [replyId]);

  useEffect(() => {
    if (notice === null) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* Das Feld wächst mit dem Text — bis zu einer Höhe, dann rollt es. */
  useLayoutEffect(() => {
    const el = area.current;
    if (el === null) return;
    /* Leer: eine Zeile — ein langer Platzhalter („Wiadomość jako …") soll das Feld nicht aufblähen. */
    if (text === '') { el.style.height = ''; return; }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const typing = () => {
    if (Date.now() - lastTyping.current < 4000) return;
    lastTyping.current = Date.now();
    void call(`${endpoint}/typing`, { method: 'POST' }).catch(() => undefined);
  };

  /* Eine Nachricht aus dem Ausgang hinausschicken — mit ihrem eigenen Fortschritt. */
  const deliver = async (item: Outgoing): Promise<void> => {
    const note = (text: string) => setOutbox((was) => was.map((o) => (o.id === item.id ? { ...o, note: text } : o)));
    const attachments: Attachment[] = [];
    for (const [i, file] of item.files.entries()) {
      const done = uploaded.current.get(file);
      if (done !== undefined) { attachments.push(done); continue; }
      const many = item.files.length > 1;
      const which = { n: i + 1, count: item.files.length };
      note(t(many ? 'chat.compose.encryptN' : 'chat.compose.encryptOne', which));
      const one = await uploadAttachment(endpoint, file, (part) => note(t(many ? 'chat.compose.uploadN' : 'chat.compose.uploadOne', { ...which, pct: Math.min(99, Math.round(part * 100)) })));
      uploaded.current.set(file, one);
      attachments.push(one);
    }
    note(t('chat.compose.sending'));
    const { sendAt, whenOnline, silent } = item.how;
    await onSend(item.body, {
      attachments,
      ...(item.reply !== null ? { replyTo: item.reply.id, replyText: (item.reply.text || t('chat.log.attachment')).slice(0, 500) } : {}),
      ...(sendAt !== undefined ? { sendAt } : {}),
      ...(whenOnline === true ? { whenOnline: true } : {}),
      ...(silent === true ? { silent: true } : {})
    });
    const quiet = silent === true ? ` ${t('chat.compose.quiet')}` : '';
    if (sendAt !== undefined) { setNotice(`${t('chat.compose.scheduledAt', { when: whenLong(sendAt, t.lang) })}${quiet}`); onScheduled?.(); }
    else if (whenOnline === true) { setNotice(`${t('chat.compose.whenOnline')}${quiet}`); onScheduled?.(); }
    else if (silent === true) setNotice(t('chat.compose.sentSilent'));
  };

  /*
   * DER AUSGANG LÄUFT: immer die erste, solange sie wartet. Scheitert eine,
   * bleibt sie stehen (mit „Ponów" und „Usuń") — die danach warten, damit
   * nichts die Reihenfolge überholt.
   */
  useEffect(() => {
    const first = outbox[0];
    if (running.current || first === undefined || first.state !== 'waiting') return;
    running.current = true;
    setOutbox((was) => was.map((o) => (o.id === first.id ? { ...o, state: 'sending' } : o)));
    void deliver(first)
      .then(() => setOutbox((was) => was.filter((o) => o.id !== first.id)))
      .catch((e: unknown) => setOutbox((was) => was.map((o) => (o.id === first.id
        ? { ...o, state: 'failed', note: null, error: failure(e, t('chat.chrome.sendFailed')) } : o))))
      .finally(() => { running.current = false; setOutbox((was) => [...was]); });
  }, [outbox]);

  /* In den Ausgang — und das Feld ist sofort wieder frei. */
  const enqueue = (body: string, list: readonly File[], how: Sending = {}) => {
    setFailed(null);
    setOutbox((was) => [...was, { id: `${Date.now()}-${Math.random()}`, body, files: list, reply, how, state: 'waiting', note: null, error: null }]);
    onClearReply();
  };

  /* Das Feld behält den Fokus — auf dem Telefon bleibt die Tastatur offen, und die nächste Nachricht geht gleich. */
  const keepFocus = () => {
    const el = area.current;
    if (el !== null && document.activeElement !== el) el.focus({ preventScroll: true });
  };

  const send = async (how: Sending = {}) => {
    if (busy !== null) return;
    const body = text.trim();
    if (editing !== null) {
      if (body === '') return;
      if (body === editing.text.trim()) { onCancelEdit(); return; }
      setBusy(t('common.saving'));
      setFailed(null);
      try { await onSaveEdit(body); } catch (e) { setFailed(failure(e, t('chat.prefs.saveFailed'))); } finally { setBusy(null); }
      return;
    }
    if (blocked !== null) { setFailed(blocked); return; }
    if (preparing > 0) return;
    if (body === '' && files.length === 0) return;
    enqueue(body, files, how);
    setText('');
    setFiles([]);
    keepFocus();
  };

  const sendVoice = async () => {
    const file = await recorder.send();
    if (file === null) return;
    if (blocked !== null) { addFiles([file]); setFailed(blocked); return; }
    enqueue('', [file]);
  };

  /*
   * DIE AUSWAHL ÖFFNEN. Das Feld ist nicht `display: none`, sondern nur
   * unsichtbar, und es bekommt den Fokus, bevor es sich öffnet: sonst gäbe das
   * schliessende Menü den Fokus an das Textfeld zurück — und auf dem Telefon
   * spränge die Tastatur über (oder vor) die Auswahl der Fotos.
   */
  const choose = (accept: string, how: { shrink: boolean; camera?: boolean }) => {
    const input = picker.current;
    if (input === null) return;
    shrinkNext.current = how.shrink;
    input.accept = accept;
    input.multiple = how.camera !== true;
    if (how.camera === true) input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
    input.focus({ preventScroll: true });
    input.click();
  };

  const insert = (emoji: string) => {
    const el = area.current;
    const from = el?.selectionStart ?? text.length;
    const to = el?.selectionEnd ?? text.length;
    setText(text.slice(0, from) + emoji + text.slice(to));
    window.requestAnimationFrame(() => {
      if (el === null) return;
      el.focus();
      el.setSelectionRange(from + emoji.length, from + emoji.length);
    });
  };

  const toggle = (kind: 'attach' | 'emoji' | 'send', el: Element) =>
    setPop((was) => (was?.kind === kind ? null : { kind, rect: el.getBoundingClientRect(), from: el }));

  if (readOnly !== null) {
    return <div className="ch-compose is-readonly"><Icon name="lock" /><span>{readOnly}</span></div>;
  }

  const content = text.trim() !== '' || files.length > 0 || preparing > 0;
  const sending = outbox.find((o) => o.state === 'sending') ?? null;
  const queued = outbox.filter((o) => o.state === 'waiting').length;
  const progress = sending === null ? null : `${sending.note ?? t('chat.compose.sending')}${queued > 0 ? ` · ${t('chat.compose.queued', { count: queued })}` : ''}`;
  const line = failed ?? recorder.failed ?? busy ?? progress ?? (preparing > 0 ? t('chat.compose.preparing') : null) ?? notice;
  const stuck = outbox.filter((o) => o.state === 'failed');

  return (
    <form className="ch-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {before}

      {(reply !== null || editing !== null) && (
        <div className="ch-context">
          <Icon name={editing !== null ? 'edit' : 'reply'} />
          <span className="ch-context-text" style={reply !== null && editing === null ? { '--ch-h': hueOf(reply.author) } as CSSProperties : undefined}>
            <strong>{editing !== null ? t('chat.compose.editing') : t('chat.compose.replyTo', { name: reply!.author })}</strong>
            <span>{(editing !== null ? editing.text : reply!.text) || t('chat.log.attachment')}</span>
          </span>
          <button type="button" className="ch-icon-btn is-small" aria-label={editing !== null ? t('chat.compose.cancelEdit') : t('chat.compose.cancelReply')}
            onClick={editing !== null ? onCancelEdit : onClearReply}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {/* 0100 — was nicht hinausging: bleibt, bis man es noch einmal schickt oder wegnimmt. 2026-10-26: mehrere auf einmal. */}
      {stuck.length > 1 && (
        <div className="ch-outbox-fail">
          <Icon name="ban" />
          <span className="ch-outbox-text"><strong>{t('chat.compose.notSentN', { count: stuck.length })}</strong></span>
          <button type="button" className="wk-link-btn" onClick={() => setOutbox((was) => was.map((x) => (x.state === 'failed' ? { ...x, state: 'waiting', error: null } : x)))}>{t('chat.compose.retryAll')}</button>
          <button type="button" className="wk-link-btn" onClick={() => setOutbox((was) => was.filter((x) => x.state !== 'failed'))}>{t('chat.compose.removeAll')}</button>
        </div>
      )}
      {stuck.map((o) => (
        <div key={o.id} className="ch-outbox-fail" role="alert">
          <Icon name="ban" />
          <span className="ch-outbox-text">
            <strong>{t('chat.compose.notSent')}</strong> {o.body !== '' ? t('chat.compose.quote', { text: `${o.body.slice(0, 80)}${o.body.length > 80 ? '…' : ''}` }) : t('chat.compose.files', { count: o.files.length })}
            {o.error !== null && <span className="ch-outbox-why"> — {o.error}</span>}
          </span>
          <button type="button" className="wk-link-btn" onClick={() => setOutbox((was) => was.map((x) => (x.id === o.id ? { ...x, state: 'waiting', error: null } : x)))}>{t('chat.compose.retry')}</button>
          <button type="button" className="wk-link-btn" onClick={() => setOutbox((was) => was.filter((x) => x.id !== o.id))}>{t('common.remove')}</button>
        </div>
      ))}

      {files.length > 0 && editing === null && (
        <div className="ch-files">
          {files.map((file, i) => (
            <FileChip key={`${file.name}-${i}`} file={file} busy={false} onRemove={() => setFiles((was) => was.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {recorder.state !== 'idle' ? (
        <div className="ch-rec">
          <button type="button" className="ch-icon-btn" aria-label={t('chat.compose.discardRec')} title={t('chat.compose.discard')} onClick={recorder.cancel}><Icon name="trash" /></button>
          <span className="ch-rec-dot" aria-hidden="true" />
          <span className="ch-rec-time" role="timer" aria-live="off">{mmss(recorder.seconds)}</span>
          <span className="ch-rec-hint">{recorder.state === 'asking' ? t('chat.compose.micOpening') : t('chat.compose.recording')}</span>
          <button type="button" className="ch-send" aria-label={t('chat.compose.sendRec')} title={t('common.send')} disabled={recorder.state !== 'recording' || busy !== null}
            onMouseDown={(e) => e.preventDefault()} onClick={() => void sendVoice()}>
            <Icon name="send" />
          </button>
        </div>
      ) : (
        <div className="ch-compose-row">
          {sendAs}
          <div className="ch-field">
            <button type="button" className="ch-icon-btn" aria-label={t('chat.compose.emoji')} title={t('chat.compose.emojiShort')} aria-haspopup="menu"
              onClick={(e) => toggle('emoji', e.currentTarget)}>
              <Icon name="smile" />
            </button>
            <textarea
              ref={area}
              value={text}
              rows={1}
              placeholder={placeholder ?? t('chat.chrome.message')}
              aria-label={t('chat.chrome.message')}
              onChange={(e) => { setText(e.target.value); if (editing === null) typing(); }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (pasted.length === 0 || editing !== null) return;
                if (e.clipboardData.getData('text') === '') e.preventDefault();
                addFiles(pasted);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !coarsePointer() && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                  return;
                }
                if (e.key === 'Escape' && (editing !== null || reply !== null)) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editing !== null) onCancelEdit(); else onClearReply();
                  return;
                }
                if (e.key === 'ArrowUp' && text === '' && editing === null && onEditLast !== undefined) {
                  e.preventDefault();
                  onEditLast();
                }
              }}
            />
            {editing === null && (
              <button type="button" className="ch-icon-btn" aria-label={t('chat.compose.attachFile')} title={t('chat.compose.attach')} aria-haspopup="menu" disabled={busy !== null}
                onClick={(e) => toggle('attach', e.currentTarget)}>
                <Icon name="clip" />
              </button>
            )}
          </div>
          {/* 0111 — wie in jedem Messenger, nur sichtbar: später, ohne Klang, wenn jemand online ist (auch per Rechtsklick / Halten des Knopfs). */}
          {content && editing === null && (
            <button type="button" className="ch-send-more" aria-label={t('chat.compose.sendOptions')} title={t('chat.compose.sendLater')} aria-haspopup="menu"
              aria-expanded={pop?.kind === 'send'} disabled={busy !== null || preparing > 0}
              onMouseDown={(e) => e.preventDefault()} onClick={(e) => toggle('send', e.currentTarget)}>
              <Icon name="chevron" />
            </button>
          )}
          {content || editing !== null || !recorder.supported ? (
            <button
              type="submit"
              className="ch-send"
              aria-label={editing !== null ? t('chat.compose.saveEdit') : t('common.send')}
              title={editing !== null ? t('common.save') : t('chat.compose.sendTitle')}
              disabled={busy !== null || preparing > 0 || (!content && editing === null)}
              onContextMenu={(e) => { if (editing !== null) return; e.preventDefault(); toggle('send', e.currentTarget); }}
              /* 0100 — der Knopf nimmt dem Feld den Fokus nicht: die Tastatur bleibt, die nächste Nachricht geht gleich. */
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                if (e.pointerType !== 'touch' || editing !== null) return;
                held.current = false;
                const el = e.currentTarget;
                hold.current = window.setTimeout(() => { held.current = true; toggle('send', el); }, 500);
              }}
              onPointerUp={() => window.clearTimeout(hold.current)}
              onPointerLeave={() => window.clearTimeout(hold.current)}
              onPointerCancel={() => window.clearTimeout(hold.current)}
              onClick={(e) => { if (held.current) { e.preventDefault(); held.current = false; } }}
            >
              <Icon name={editing !== null ? 'check' : 'send'} />
            </button>
          ) : (
            <button type="button" className="ch-send" aria-label={t('chat.compose.record')} title={t('chat.compose.record')}
              disabled={busy !== null || files.length >= 8} onClick={() => void recorder.start()}>
              <Icon name="mic" />
            </button>
          )}
        </div>
      )}

      <input ref={picker} type="file" multiple className="ch-picker" tabIndex={-1} aria-label={t('chat.compose.pickFiles')}
        onChange={(e) => { addFiles(Array.from(e.target.files ?? []), shrinkNext.current); e.target.value = ''; }} />

      {line !== null && (
        <p className={cls('ch-compose-line', (failed !== null || recorder.failed !== null) && 'is-error')} role={failed !== null ? 'alert' : 'status'}>{line}</p>
      )}

      {pop?.kind === 'attach' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label={t('chat.compose.attach')} onClose={() => setPop(null)} items={[
          ...(coarsePointer() ? [{ label: t('chat.compose.takePhoto'), icon: 'camera' as const, onSelect: () => choose('image/*', { shrink: true, camera: true }) }] : []),
          { label: t('chat.compose.photos'), icon: 'image', onSelect: () => choose('image/*,video/*', { shrink: true }) },
          { label: t('chat.compose.fileRaw'), icon: 'file', onSelect: () => choose('', { shrink: false }) },
          { label: t('chat.compose.audio'), icon: 'music', onSelect: () => choose('audio/*', { shrink: false }) }
        ]} />
      )}
      {pop?.kind === 'send' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label={t('chat.compose.sendingMenu')} onClose={() => setPop(null)} items={[
          { label: t('chat.compose.sendSilent'), icon: 'bell-off', onSelect: () => void send({ silent: true }) },
          ...(onlineSend !== null ? [{ label: onlineSend, icon: 'users' as const, onSelect: () => void send({ whenOnline: true }) }] : []),
          { label: t('chat.compose.schedule'), icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {pop?.kind === 'emoji' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label={t('chat.compose.emojiShort')} kind="emoji" onClose={() => setPop(null)}>
          <div className="ch-emoji-grid">
            {EMOJI.map((emoji) => (
              <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => insert(emoji)}>{emoji}</button>
            ))}
          </div>
        </PopMenu>
      )}
      {planning && <PlanDialog onClose={() => setPlanning(false)} onPlan={(iso, silent) => void send({ sendAt: iso, ...(silent ? { silent: true } : {}) })} />}
    </form>
  );
});
