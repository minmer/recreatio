/**
 * DAS SCHREIBFELD einer SMS (MMS mit Bild oder an eine Gruppe) — im Gespräch,
 * in „Nowa wiadomość" und im Blatt „Napisz SMS" (`SmsSheet`). Es sendet selbst
 * (`Phone.send`); wer es zeigt, erfährt nur, in welches Gespräch es ging.
 *
 * 2026-10-18 — „Wyślij później" (die Uhr): das Telefon sendet zur gewählten Zeit
 * selbst, auch ohne Netz (`ScheduledSms`). Nur Text — ein Bild als MMS oder eine
 * Gruppe geht gleich.
 *
 * 2026-10-18 — ZAŁĄCZNIK JAKO LINK (0117): ein Foto, ein Film, jede Datei bis 25 MB
 * geht auf Wunsch nicht als MMS (die der Netzbetreiber auf ein paar hundert KB
 * drückt), sondern verschlüsselt nach recreatio.pl; in die SMS kommt der Link
 * (`share.ts`). Wie zuletzt gesendet wurde, bleibt gemerkt.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { useRemembered } from '../core/prefs';
import { WorkspaceError, type Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Phone, type PhoneStatus } from './native';
import { smsParts } from './numbers';
import { openPhone } from './phoneContext';
import { daysLabel, SHARE_DAYS, SHARE_MAX, shareFile, shareLink, sizeText } from './share';
import { aheadWhen, localInput } from './smsShared';

interface Attachment {
  readonly file: File;
  readonly type: string;
  readonly name: string;
  readonly size: number;
  /** Bei einem Bild: seine Adresse im Browser, für die Vorschau. */
  readonly preview: string | null;
}

/** Was als MMS gehen kann — ein Bild (das Telefon verkleinert es), ein Film, ein Ton. */
const mmsAble = (type: string): boolean => type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/');

/** Für die MMS: der Inhalt als base64, ohne das Präfix der data:-Adresse. */
const base64Of = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    resolve(url.slice(url.indexOf(',') + 1));
  };
  reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
  reader.readAsDataURL(file);
});

/** So lang wird ein Link — zum Zählen der SMS. */
const LINK_SAMPLE = shareLink('x'.repeat(22));

/** Der Text mit dem Link darunter. */
export const withLinkText = (text: string, link: string): string => (text.trim() === '' ? link : `${text.trimEnd()}\n${link}`);

export function Composer({ to, sims, defaultSub, disabled, onSent, onScheduled, initial = '', separate = false, media = true, who }: {
  to: readonly string[];
  sims: PhoneStatus['sims'];
  defaultSub: number | null;
  disabled: boolean;
  onSent: (threadId: string) => void;
  /** Gesetzt: „Wyślij później" gibt es — gerufen mit den Gesprächen, in denen nun eine geplant ist. */
  onScheduled?: (threadIds: readonly string[]) => void;
  initial?: string;
  /** Mehrere Empfänger, jeder für sich (eine SMS je Mensch) statt einer Gruppe. */
  separate?: boolean;
  /** Ein Bild anhängen (MMS) — im Blatt „Napisz SMS" nicht. */
  media?: boolean;
  /** Gesetzt: ein Anhang kann auch als Link gehen (versiegelt im eigenen Bereich). */
  who?: Who;
}) {
  const [text, setText] = useState(initial);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sub, setSub] = useState<number | null>(defaultSub);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState<string | null>(null);
  const [howText, setHowText] = useRemembered('sms.attach', 'link');
  const [daysText, setDaysText] = useRemembered('sms.linkDays', '30');
  const [progress, setProgress] = useState<number | null>(null);
  /** Schon oben: ein zweiter Versuch (das Senden schlug fehl) lädt nicht noch einmal. */
  const uploaded = useRef<{ readonly file: File; readonly link: string } | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { setSub(defaultSub); }, [defaultSub]);
  useEffect(() => {
    const el = field.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 192)}px`;
  }, [text]);
  /* Die Vorschau eines Bildes gibt ihre Adresse wieder frei. */
  useEffect(() => () => { if (attachment?.preview) URL.revokeObjectURL(attachment.preview); }, [attachment]);

  const linkable = who !== undefined;
  const days = (SHARE_DAYS as readonly number[]).includes(Number(daysText)) ? Number(daysText) : 30;
  const how: 'mms' | 'link' = attachment === null || !linkable ? 'mms'
    : !mmsAble(attachment.type) ? 'link'
    : howText === 'mms' ? 'mms' : 'link';
  const viaLink = attachment !== null && how === 'link';
  const group = to.length > 1 && !separate;
  const mms = (attachment !== null && !viaLink) || group;
  const count = smsParts(viaLink ? withLinkText(text, LINK_SAMPLE) : text);
  const mmsMax = sims.find((s) => s.subId === sub)?.mmsMax ?? sims[0]?.mmsMax ?? 300 * 1024;

  const attach = (file: File) => {
    if (file.size > SHARE_MAX) { toast('Plik może mieć najwyżej 25 MB.'); return; }
    const type = file.type || 'application/octet-stream';
    if (!mmsAble(type) && !linkable) { toast('Taki plik można wysłać tylko jako link.'); return; }
    uploaded.current = null;
    setAttachment({ file, type, name: file.name, size: file.size, preview: type.startsWith('image/') ? URL.createObjectURL(file) : null });
  };
  const drop = () => { setAttachment(null); uploaded.current = null; };

  /** Die Datei hinauf (einmal) und der Link unter den Text. */
  const linked = async (a: Attachment): Promise<string> => {
    let link = uploaded.current !== null && uploaded.current.file === a.file ? uploaded.current.link : null;
    if (link === null) {
      if (who === undefined) throw new Error('Nie da się wysłać linku.');
      setProgress(0);
      try {
        const ctx = await openPhone(who);
        link = (await shareFile(ctx, a.file, { days, to, onProgress: (done, total) => setProgress(total > 0 ? done / total : 0) })).link;
        uploaded.current = { file: a.file, link };
      } finally {
        setProgress(null);
      }
    }
    return withLinkText(text, link);
  };

  const send = async () => {
    if (busy || to.length === 0 || (text.trim() === '' && attachment === null)) return;
    setBusy(true);
    try {
      const body = viaLink && attachment !== null ? await linked(attachment) : text;
      const file = !viaLink && attachment !== null ? { type: attachment.type, data: await base64Of(attachment.file), name: attachment.name } : null;
      const { threadId } = await Phone.send({ to, body, subId: sub, group, attachment: file });
      setText('');
      drop();
      onSent(threadId);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };
  /* Später: Text (auch mit Link), keine MMS und keine Gruppe; die Zeit in der Zukunft. */
  const canLater = onScheduled !== undefined && !group && (attachment === null || viaLink);
  const schedule = async () => {
    const at = later === null ? NaN : new Date(later).getTime();
    if (!Number.isFinite(at) || at <= Date.now()) { toast('Wybierz czas w przyszłości.'); return; }
    if (busy || to.length === 0 || (text.trim() === '' && !viaLink)) return;
    setBusy(true);
    try {
      const body = viaLink && attachment !== null ? await linked(attachment) : text;
      /* Mehrere (osobno): je eine — jede in ihrem Gespräch. */
      const threads: string[] = [];
      for (const one of to) threads.push((await Phone.schedule({ to: [one], body, sendAt: at, subId: sub ?? -1 })).entry.threadId);
      setText('');
      drop();
      setLater(null);
      toast(`Zaplanowano: ${aheadWhen(at)}.`);
      onScheduled?.(threads);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się zaplanować.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file !== undefined) attach(file);
  };

  const sendLabel = !busy ? 'Wyślij' : progress !== null ? `${Math.round(progress * 100)}%` : 'Wysyłanie…';
  return (
    <div className="ph-composer">
      {attachment !== null && (
        <div className="ph-attached">
          {attachment.preview !== null ? <img src={attachment.preview} alt="" /> : <span className="ph-attached-file"><Icon name="file" />{attachment.name}</span>}
          <span className="ph-attached-size">{sizeText(attachment.size)}</span>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={drop}>Usuń załącznik</button>
        </div>
      )}
      {attachment !== null && linkable && (
        <div className="ph-attach-how" role="radiogroup" aria-label="Jak wysłać załącznik">
          <label className="wk-check">
            <input type="radio" checked={how === 'link'} disabled={busy} onChange={() => setHowText('link')} />
            <span>Link — pełna jakość, zaszyfrowany</span>
          </label>
          {how === 'link' && (
            <select aria-label="Jak długo działa link" value={days} disabled={busy} onChange={(e) => setDaysText(e.target.value)}>
              {SHARE_DAYS.map((d) => <option key={d} value={d}>ważny {daysLabel(d)}</option>)}
            </select>
          )}
          <label className="wk-check">
            <input type="radio" checked={how === 'mms'} disabled={busy || !mmsAble(attachment.type)} onChange={() => setHowText('mms')} />
            <span>MMS — {attachment.type.startsWith('image/') ? `zmniejszone do ${sizeText(mmsMax)}` : `najwyżej ${sizeText(mmsMax)}`} (limit operatora)</span>
          </label>
        </div>
      )}
      <div className="ph-composer-row">
        {media && (
          <label className="wk-icon-btn" aria-label="Dodaj zdjęcie lub film" title="Dodaj zdjęcie lub film">
            <Icon name="image" />
            <input className="ph-attach-input" type="file" accept="image/*,video/*,audio/*" onChange={pick} disabled={disabled || busy} />
          </label>
        )}
        {media && linkable && (
          <label className="wk-icon-btn" aria-label="Dodaj plik (pójdzie jako link)" title="Dodaj plik (pójdzie jako link)">
            <Icon name="clip" />
            <input className="ph-attach-input" type="file" onChange={pick} disabled={disabled || busy} />
          </label>
        )}
        <textarea ref={field} rows={1} value={text} placeholder={disabled ? 'Najpierw ustaw tę aplikację jako aplikację SMS' : mms ? 'MMS' : 'SMS'}
          aria-label="Treść wiadomości" disabled={disabled} onChange={(e) => setText(e.target.value)} />
        {canLater && (
          <button type="button" className={`wk-icon-btn${later !== null ? ' is-on' : ''}`} aria-label="Wyślij później" title="Wyślij później"
            aria-pressed={later !== null} disabled={disabled || busy}
            onClick={() => setLater(later === null ? localInput(Date.now() + 3600_000) : null)}>
            <Icon name="clock" />
          </button>
        )}
        <button type="button" className="wk-btn" disabled={disabled || busy || (text.trim() === '' && attachment === null)} onClick={() => void send()}>
          <Icon name="send" />{sendLabel}
        </button>
      </div>
      {progress !== null && <progress className="ph-progress" value={progress} max={1} aria-label="Przesyłanie pliku" />}
      {canLater && later !== null && (
        <div className="ph-later">
          <label>
            Wyślij{' '}
            <input type="datetime-local" value={later} min={localInput(Date.now())} onChange={(e) => setLater(e.target.value)} />
          </label>
          <button type="button" className="wk-btn" disabled={disabled || busy || (text.trim() === '' && !viaLink)} onClick={() => void schedule()}>
            <Icon name="clock" />Zaplanuj
          </button>
        </div>
      )}
      <div className="ph-composer-info">
        {!mms && (text !== '' || viaLink) && (
          <span>{count.parts > 1 ? `${count.parts} SMS · ` : ''}zostało {count.left}{count.unicode ? ' (polskie znaki: 70 na SMS)' : ''}{viaLink ? ' · z linkiem' : ''}</span>
        )}
        {mms && <span>{group ? `MMS do ${to.length} osób (grupa)` : 'MMS'}</span>}
        {to.length > 1 && separate && <span>{`osobno do każdej z ${to.length} osób`}</span>}
        {sims.length > 1 && (
          <label>
            Karta SIM{' '}
            <select value={sub ?? ''} onChange={(e) => setSub(e.target.value === '' ? null : Number(e.target.value))}>
              {sims.map((s) => <option key={s.subId} value={s.subId}>{s.name}{s.number !== null ? ` (${s.number})` : ''}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
