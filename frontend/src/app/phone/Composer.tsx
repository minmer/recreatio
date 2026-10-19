/**
 * DAS SCHREIBFELD einer SMS (MMS mit Bild oder an eine Gruppe) — im Gespräch,
 * in „Nowa wiadomość" und im Blatt „Napisz SMS" (`SmsSheet`). Es sendet selbst
 * (`Phone.send`); wer es zeigt, erfährt nur, in welches Gespräch es ging.
 *
 * 2026-10-18 — „Wyślij później": das Telefon sendet zur gewählten Zeit selbst, auch
 * ohne Netz (`ScheduledSms`). Nur Text — ein Bild als MMS oder eine Gruppe geht gleich.
 *
 * 2026-10-18 — ZAŁĄCZNIK JAKO LINK (0117): ein Foto, ein Film, jede Datei bis 25 MB
 * geht auf Wunsch nicht als MMS (die der Netzbetreiber auf ein paar hundert KB
 * drückt), sondern verschlüsselt nach recreatio.pl; in die SMS kommt der Link
 * (`share.ts`). Wie zuletzt gesendet wurde, bleibt gemerkt.
 *
 * 2026-10-19 — WIE DAS FELD DES CHATS: ein rundes Feld mit 📎 (Foto, Film, Datei),
 * Senden als runder Knopf, daneben die Lasche für „Wyślij później". Von welcher Karte
 * gesendet wird, entscheidet der Kopf des Gesprächs (`sub`, `lines.ts`).
 */

import { useEffect, useRef, useState } from 'react';

import { coarsePointer, cls, Icon, PopMenu, type Anchor } from '../chat/ChatKit';
import { useRemembered } from '../core/prefs';
import { WorkspaceError, type Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Phone, type PhoneStatus } from './native';
import { smsParts } from './numbers';
import { openPhone } from './phoneContext';
import { daysLabel, SHARE_DAYS, SHARE_MAX, shareFile, shareLink, sizeText } from './share';
import { PlanDialog } from './smsChat';
import { aheadWhen } from './smsShared';

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

export function Composer({ to, sub, sims, disabled, onSent, onScheduled, initial = '', separate = false, media = true, who }: {
  to: readonly string[];
  /** Die Karte, von der gesendet wird — der Kopf des Gesprächs wählt sie (`null`: die des Telefons). */
  sub: number | null;
  sims: PhoneStatus['sims'];
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
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [menu, setMenu] = useState<{ kind: 'attach' | 'send'; anchor: Anchor; from: Element } | null>(null);
  const [howText, setHowText] = useRemembered('sms.attach', 'link');
  const [daysText, setDaysText] = useRemembered('sms.linkDays', '30');
  const [progress, setProgress] = useState<number | null>(null);
  /** Schon oben: ein zweiter Versuch (das Senden schlug fehl) lädt nicht noch einmal. */
  const uploaded = useRef<{ readonly file: File; readonly link: string } | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = field.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 180)}px`;
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
  const content = text.trim() !== '' || attachment !== null;

  const attach = (file: File) => {
    if (file.size > SHARE_MAX) { toast('Plik może mieć najwyżej 25 MB.'); return; }
    const type = file.type || 'application/octet-stream';
    if (!mmsAble(type) && !linkable) { toast('Taki plik można wysłać tylko jako link.'); return; }
    uploaded.current = null;
    setAttachment({ file, type, name: file.name, size: file.size, preview: type.startsWith('image/') ? URL.createObjectURL(file) : null });
  };
  const drop = () => { setAttachment(null); uploaded.current = null; };

  /** Die Auswahl öffnen — Fotos, Filme, eine Datei, die Kamera. */
  const choose = (accept: string, camera = false) => {
    const input = picker.current;
    if (input === null) return;
    input.accept = accept;
    if (camera) input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
    input.click();
  };

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
    if (busy || disabled || to.length === 0 || !content) return;
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

  /* Später: Text (auch mit Link), keine MMS und keine Gruppe. */
  const canLater = onScheduled !== undefined && !group && (attachment === null || viaLink);
  const schedule = async (at: number) => {
    if (busy || to.length === 0 || (text.trim() === '' && !viaLink)) return;
    setBusy(true);
    try {
      const body = viaLink && attachment !== null ? await linked(attachment) : text;
      /* Mehrere (osobno): je eine — jede in ihrem Gespräch. */
      const threads: string[] = [];
      for (const one of to) threads.push((await Phone.schedule({ to: [one], body, sendAt: at, subId: sub ?? -1 })).entry.threadId);
      setText('');
      drop();
      toast(`Zaplanowano: ${aheadWhen(at)}.`);
      onScheduled?.(threads);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się zaplanować.');
    } finally {
      setBusy(false);
    }
  };

  const open = (kind: 'attach' | 'send', el: Element) =>
    setMenu((was) => (was?.kind === kind ? null : { kind, anchor: { rect: el.getBoundingClientRect(), above: true }, from: el }));

  const line = disabled ? 'Najpierw ustaw tę aplikację jako aplikację SMS.'
    : busy && progress !== null ? `Wysyłanie pliku… ${Math.round(progress * 100)}%`
    : mms ? (group ? `MMS do ${to.length} osób (grupa)` : 'MMS')
    : text !== '' || viaLink ? `${count.parts > 1 ? `${count.parts} SMS · ` : ''}zostało ${count.left}${count.unicode ? ' (polskie znaki: 70 na SMS)' : ''}${viaLink ? ' · z linkiem' : ''}`
    : null;

  return (
    <form className="ch-compose ph-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {attachment !== null && (
        <div className="ch-files">
          <span className="ch-file-chip">
            {attachment.preview !== null ? <img src={attachment.preview} alt="" /> : <span className="ch-file-ic"><Icon name="file" /></span>}
            <span className="ch-file-text"><span className="ch-file-name">{attachment.name}</span><small>{sizeText(attachment.size)}</small></span>
            <button type="button" className="ch-icon-btn is-small" aria-label={`Usuń załącznik ${attachment.name}`} disabled={busy} onClick={drop}><Icon name="x" /></button>
          </span>
        </div>
      )}
      {attachment !== null && linkable && (
        <div className="ph-attach-how" role="radiogroup" aria-label="Jak wysłać załącznik">
          <button type="button" className={cls('ch-chip', how === 'link' && 'is-on')} role="radio" aria-checked={how === 'link'} disabled={busy}
            onClick={() => setHowText('link')}>
            <Icon name="link" />Link — pełna jakość
          </button>
          <button type="button" className={cls('ch-chip', how === 'mms' && 'is-on')} role="radio" aria-checked={how === 'mms'}
            disabled={busy || !mmsAble(attachment.type)} onClick={() => setHowText('mms')}>
            <Icon name="image" />MMS — {attachment.type.startsWith('image/') ? `do ${sizeText(mmsMax)}` : `najwyżej ${sizeText(mmsMax)}`}
          </button>
          {how === 'link' && (
            <select aria-label="Jak długo działa link" value={days} disabled={busy} onChange={(e) => setDaysText(e.target.value)}>
              {SHARE_DAYS.map((d) => <option key={d} value={d}>ważny {daysLabel(d)}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="ch-compose-row">
        <div className="ch-field">
          <textarea ref={field} rows={1} value={text} placeholder={mms ? 'MMS' : 'SMS'}
            aria-label="Treść wiadomości" disabled={disabled} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !coarsePointer() && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
            }} />
          {media && (
            <button type="button" className="ch-icon-btn" aria-label="Dołącz" title="Zdjęcie, film albo plik" aria-haspopup="menu"
              aria-expanded={menu?.kind === 'attach'} disabled={disabled || busy} onClick={(e) => open('attach', e.currentTarget)}>
              <Icon name="clip" />
            </button>
          )}
        </div>
        {canLater && content && (
          <button type="button" className="ch-send-more" aria-label="Wyślij później" title="Wyślij później" aria-haspopup="menu"
            aria-expanded={menu?.kind === 'send'} disabled={disabled || busy} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => open('send', e.currentTarget)}>
            <Icon name="chevron" />
          </button>
        )}
        <button type="submit" className="ch-send" aria-label="Wyślij" title="Wyślij" disabled={disabled || busy || !content}
          onMouseDown={(e) => e.preventDefault()}>
          <Icon name="send" />
        </button>
      </div>
      {progress !== null && <progress className="ph-progress" value={progress} max={1} aria-label="Przesyłanie pliku" />}
      {line !== null && <p className="ch-compose-line" role="status">{line}</p>}

      <input ref={picker} type="file" className="ch-picker" tabIndex={-1} aria-label="Wybierz plik"
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file !== undefined) attach(file); }} />

      {menu?.kind === 'attach' && (
        <PopMenu anchor={menu.anchor} from={menu.from} label="Dołącz" onClose={() => setMenu(null)} items={[
          ...(coarsePointer() ? [{ label: 'Zrób zdjęcie', icon: 'camera' as const, onSelect: () => choose('image/*', true) }] : []),
          { label: 'Zdjęcia i filmy', icon: 'image', onSelect: () => choose('image/*,video/*') },
          ...(linkable ? [{ label: 'Plik — wyślę jako link', icon: 'file' as const, onSelect: () => choose('') }] : [])
        ]} />
      )}
      {menu?.kind === 'send' && (
        <PopMenu anchor={menu.anchor} from={menu.from} label="Wysyłanie" onClose={() => setMenu(null)} items={[
          { label: 'Wyślij później…', icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {planning && (
        <PlanDialog onClose={() => setPlanning(false)} onPlan={(at) => void schedule(at)}
          note="Telefon wyśle ją o tej porze sam — także bez internetu." />
      )}
    </form>
  );
}
