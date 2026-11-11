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
 *
 * 2026-11-09 — ENTWÜRFE (`draft`, `smsDrafts.ts`): was im Feld steht, bleibt beim Wechsel
 * der Ansicht. PRZEKAŻ — KAŻDA OSOBNO (`queue`): weitergeleitete Nachrichten gehen nach
 * dem Text des Feldes einzeln hinaus, jede als eigene SMS, in ihrer Reihenfolge.
 *
 * 2026-11-11 — MEHRERE DATEIEN: als Links alle in EINER SMS (je ein Link in einer Zeile); als
 * MMS je Datei eine MMS (der Text mit der ersten) — das Telefon setzt eine MMS aus einem Teil.
 * Ist eine Datei keine für MMS, gehen alle als Link.
 */

import { useEffect, useRef, useState } from 'react';

import { coarsePointer, cls, Icon, PopMenu, type Anchor } from '../chat/ChatKit';
import { useT } from '../core/i18n';
import { useRemembered } from '../core/prefs';
import { WorkspaceError, type Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Phone, type PhoneStatus } from './native';
import { smsParts } from './numbers';
import { openPhone } from './phoneContext';
import { daysLabel, shareFile } from './share';
import { SHARE_DAYS, SHARE_MAX, shareLink, sizeText } from './shareSeal';
import { PlanDialog } from './smsChat';
import { keepDraft, startText } from './smsDrafts';
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
const base64Of = (file: File, failed: string): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    resolve(url.slice(url.indexOf(',') + 1));
  };
  reader.onerror = () => reject(new Error(failed));
  reader.readAsDataURL(file);
});

/** So lang wird ein Link — zum Zählen der SMS. */
const LINK_SAMPLE = shareLink('x'.repeat(22));

const NO_QUEUE: readonly string[] = [];

/** Der Text mit dem Link (den Links, je einer in einer Zeile) darunter. */
export const withLinkText = (text: string, link: string | readonly string[]): string => {
  const links = typeof link === 'string' ? link : link.join('\n');
  return text.trim() === '' ? links : `${text.trimEnd()}\n${links}`;
};

export function Composer({ to, sub, sims, disabled, onSent, onScheduled, initial = '', separate = false, media = true, who, onWrite, draft, draftTo, queue = NO_QUEUE, onQueueSent }: {
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
  /** Man beginnt zu schreiben (das Feld bekommt den Fokus) — das Gespräch geht ans Ende. */
  onWrite?: () => void;
  /** Unter diesem Namen bleibt der Entwurf (`smsDrafts.ts`) — fehlt er, bleibt nichts. */
  draft?: string;
  /** Mit dem Entwurf gemerkt: an wen („Nowa wiadomość"). */
  draftTo?: readonly string[];
  /** Weitergeleitete Nachrichten, jede als eigene SMS — nach dem Text des Feldes. */
  queue?: readonly string[];
  /** Die erste aus `queue` ist hinaus (gesendet oder geplant). */
  onQueueSent?: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(() => (draft === undefined ? initial : startText(draft, initial)));
  /* Der Entwurf folgt dem Feld — gesendet ist das Feld leer, und er ist vergessen. */
  useEffect(() => { if (draft !== undefined) keepDraft(draft, text, draftTo); }, [draft, text, draftTo]);
  const [attachments, setAttachments] = useState<readonly Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [menu, setMenu] = useState<{ kind: 'attach' | 'send'; anchor: Anchor; from: Element } | null>(null);
  const [howText, setHowText] = useRemembered('sms.attach', 'link');
  const [daysText, setDaysText] = useRemembered('sms.linkDays', '30');
  const [progress, setProgress] = useState<number | null>(null);
  /** Schon oben: ein zweiter Versuch (das Senden schlug fehl) lädt nicht noch einmal. */
  const uploaded = useRef(new Map<File, string>());
  const field = useRef<HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = field.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 180)}px`;
  }, [text]);
  /* Die Vorschauen der Bilder geben ihre Adressen wieder frei — auch, wenn das Feld geht. */
  const previews = useRef(attachments);
  previews.current = attachments;
  useEffect(() => () => { for (const a of previews.current) if (a.preview) URL.revokeObjectURL(a.preview); }, []);

  const linkable = who !== undefined;
  const days = (SHARE_DAYS as readonly number[]).includes(Number(daysText)) ? Number(daysText) : 30;
  const attached = attachments.length > 0;
  const allMms = attachments.every((a) => mmsAble(a.type));
  const how: 'mms' | 'link' = !attached || !linkable ? 'mms'
    : !allMms ? 'link'
    : howText === 'mms' ? 'mms' : 'link';
  const viaLink = attached && how === 'link';
  const group = to.length > 1 && !separate;
  const mms = (attached && !viaLink) || group;
  const count = smsParts(viaLink ? withLinkText(text, attachments.map(() => LINK_SAMPLE)) : text);
  const mmsMax = sims.find((s) => s.subId === sub)?.mmsMax ?? sims[0]?.mmsMax ?? 300 * 1024;
  const own = text.trim() !== '' || attached;
  const content = own || queue.length > 0;

  const attach = (files: readonly File[]) => {
    const fresh: Attachment[] = [];
    for (const file of files) {
      if (file.size > SHARE_MAX) { toast(t('phoneSms.compose.tooBigName', { name: file.name })); continue; }
      const type = file.type || 'application/octet-stream';
      if (!mmsAble(type) && !linkable) { toast(t('phoneSms.compose.linkOnly')); continue; }
      fresh.push({ file, type, name: file.name, size: file.size, preview: type.startsWith('image/') ? URL.createObjectURL(file) : null });
    }
    if (fresh.length > 0) setAttachments((had) => [...had, ...fresh]);
  };
  /** Eine Datei weg — oder (ohne Angabe) alle. */
  const drop = (one?: Attachment) => {
    setAttachments((had) => {
      for (const a of had) {
        if (one !== undefined && a !== one) continue;
        if (a.preview) URL.revokeObjectURL(a.preview);
        uploaded.current.delete(a.file);
      }
      return one === undefined ? [] : had.filter((a) => a !== one);
    });
  };

  /** Die Auswahl öffnen — Fotos, Filme, eine Datei, die Kamera. */
  const choose = (accept: string, camera = false) => {
    const input = picker.current;
    if (input === null) return;
    input.accept = accept;
    if (camera) input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
    input.click();
  };

  /** Die Dateien hinauf (jede einmal, eine nach der anderen) und ihre Links unter den Text. */
  const linked = async (list: readonly Attachment[]): Promise<string> => {
    const links: string[] = [];
    for (const [i, a] of list.entries()) {
      let link = uploaded.current.get(a.file) ?? null;
      if (link === null) {
        if (who === undefined) throw new Error(t('phoneSms.compose.noLink'));
        setProgress(i / list.length);
        try {
          const ctx = await openPhone(who);
          link = (await shareFile(ctx, a.file, { days, to, onProgress: (done, total) => setProgress((i + (total > 0 ? done / total : 0)) / list.length) })).link;
          uploaded.current.set(a.file, link);
        } finally {
          setProgress(null);
        }
      }
      links.push(link);
    }
    return withLinkText(text, links);
  };

  const send = async () => {
    if (busy || disabled || to.length === 0 || !content) return;
    setBusy(true);
    let threadId: string | null = null;
    try {
      if (own && (viaLink || !attached)) {
        const body = viaLink ? await linked(attachments) : text;
        threadId = (await Phone.send({ to, body, subId: sub, group, attachment: null })).threadId;
        setText('');
        drop();
      } else if (own) {
        /* Als MMS: je Datei eine, der Text mit der ersten; was hinaus ist, fällt weg (ein zweiter Versuch sendet nur den Rest). */
        let body = text;
        for (const a of attachments) {
          const file = { type: a.type, data: await base64Of(a.file, t('phoneSms.compose.readFailed')), name: a.name };
          threadId = (await Phone.send({ to, body, subId: sub, group, attachment: file })).threadId;
          body = '';
          setText('');
          drop(a);
        }
      }
      /* Weitergeleitete einzeln, der Reihe nach — was hinaus ist, fällt weg (ein zweiter Versuch sendet nur den Rest). */
      for (const one of queue) {
        threadId = (await Phone.send({ to, body: one, subId: sub, group, attachment: null })).threadId;
        onQueueSent?.();
      }
      onSent(threadId!);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('phoneSms.compose.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  /* Später: Text (auch mit Link), keine MMS und keine Gruppe. */
  const canLater = onScheduled !== undefined && !group && (!attached || viaLink);
  const schedule = async (at: number) => {
    if (busy || to.length === 0 || (text.trim() === '' && !viaLink && queue.length === 0)) return;
    setBusy(true);
    try {
      const threads = new Set<string>();
      if (text.trim() !== '' || viaLink) {
        const body = viaLink ? await linked(attachments) : text;
        /* Mehrere (osobno): je eine — jede in ihrem Gespräch. */
        for (const one of to) threads.add((await Phone.schedule({ to: [one], body, sendAt: at, subId: sub ?? -1 })).entry.threadId);
        setText('');
        drop();
      }
      /* Weitergeleitete: je eine Sekunde später — so bleibt ihre Reihenfolge. */
      for (const [i, body] of queue.entries()) {
        for (const one of to) threads.add((await Phone.schedule({ to: [one], body, sendAt: at + (i + 1) * 1000, subId: sub ?? -1 })).entry.threadId);
        onQueueSent?.();
      }
      toast(t('phoneSms.compose.scheduled', { when: aheadWhen(at) }));
      onScheduled?.([...threads]);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('phoneSms.compose.scheduleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const open = (kind: 'attach' | 'send', el: Element) =>
    setMenu((was) => (was?.kind === kind ? null : { kind, anchor: { rect: el.getBoundingClientRect(), above: true }, from: el }));

  /* 2026-10-26 — ohne Empfänger lässt sich schon schreiben; nur Senden wartet (vorher hiess es hier fälschlich „ustaw … jako aplikację SMS"). */
  const noOne = to.length === 0;
  const line = disabled ? t('phoneSms.compose.notDefault')
    : noOne && content ? t('phoneSms.compose.chooseTo')
    : busy && progress !== null ? t('phoneSms.compose.uploading', { percent: Math.round(progress * 100) })
    : mms ? (group ? t('phoneSms.compose.mmsGroup', { count: to.length }) : attachments.length > 1 ? t('phoneSms.compose.mmsEach', { count: attachments.length }) : t('phoneSms.compose.mms'))
    : queue.length > 0 && text === '' && !viaLink ? t('phoneSms.compose.queued', { count: queue.length })
    : text !== '' || viaLink ? [
      queue.length > 0 ? t('phoneSms.compose.queued', { count: queue.length }) : null,
      count.parts > 1 ? t('phoneSms.compose.parts', { count: count.parts }) : null,
      t('phoneSms.compose.left', { left: count.left }) + (count.unicode ? t('phoneSms.compose.unicode') : ''),
      viaLink ? (attachments.length > 1 ? t('phoneSms.compose.withLinks', { count: attachments.length }) : t('phoneSms.compose.withLink')) : null
    ].filter((x): x is string => x !== null).join(' · ')
    : null;

  return (
    <form className="ch-compose ph-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {attached && (
        <div className="ch-files">
          {attachments.map((a, i) => (
            <span key={`${i}:${a.name}`} className="ch-file-chip">
              {a.preview !== null ? <img src={a.preview} alt="" /> : <span className="ch-file-ic"><Icon name="file" /></span>}
              <span className="ch-file-text"><span className="ch-file-name">{a.name}</span><small>{sizeText(a.size)}</small></span>
              <button type="button" className="ch-icon-btn is-small" aria-label={t('phoneSms.compose.removeAttachment', { name: a.name })} disabled={busy} onClick={() => drop(a)}><Icon name="x" /></button>
            </span>
          ))}
        </div>
      )}
      {attached && linkable && (
        <div className="ph-attach-how" role="radiogroup" aria-label={t('phoneSms.compose.how')}>
          <button type="button" className={cls('ch-chip', how === 'link' && 'is-on')} role="radio" aria-checked={how === 'link'} disabled={busy}
            onClick={() => setHowText('link')}>
            <Icon name="link" />{t('phoneSms.compose.howLink')}
          </button>
          <button type="button" className={cls('ch-chip', how === 'mms' && 'is-on')} role="radio" aria-checked={how === 'mms'}
            disabled={busy || !allMms} onClick={() => setHowText('mms')}>
            <Icon name="image" />{attachments.every((a) => a.type.startsWith('image/')) ? t('phoneSms.compose.howMmsImage', { size: sizeText(mmsMax) }) : t('phoneSms.compose.howMms', { size: sizeText(mmsMax) })}
          </button>
          {how === 'link' && (
            <select aria-label={t('phoneSms.compose.linkDays')} value={days} disabled={busy} onChange={(e) => setDaysText(e.target.value)}>
              {SHARE_DAYS.map((d) => <option key={d} value={d}>{t('phoneSms.compose.valid', { days: daysLabel(d) })}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="ch-compose-row">
        <div className="ch-field">
          <textarea ref={field} rows={1} value={text} placeholder={mms ? t('phoneSms.compose.mms') : t('phoneSms.compose.sms')}
            aria-label={t('phoneSms.compose.body')} disabled={disabled} onChange={(e) => setText(e.target.value)} onFocus={onWrite}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !coarsePointer() && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
            }} />
          {media && (
            <button type="button" className="ch-icon-btn" aria-label={t('phoneSms.compose.attach')} title={t('phoneSms.compose.attachTitle')} aria-haspopup="menu"
              aria-expanded={menu?.kind === 'attach'} disabled={disabled || busy} onClick={(e) => open('attach', e.currentTarget)}>
              <Icon name="clip" />
            </button>
          )}
        </div>
        {canLater && content && (
          <button type="button" className="ch-send-more" aria-label={t('phoneSms.compose.later')} title={t('phoneSms.compose.later')} aria-haspopup="menu"
            aria-expanded={menu?.kind === 'send'} disabled={disabled || busy || noOne} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => open('send', e.currentTarget)}>
            <Icon name="chevron" />
          </button>
        )}
        <button type="submit" className="ch-send" aria-label={t('common.send')} title={t('common.send')} disabled={disabled || busy || !content || noOne}
          onMouseDown={(e) => e.preventDefault()}>
          <Icon name="send" />
        </button>
      </div>
      {progress !== null && <progress className="ph-progress" value={progress} max={1} aria-label={t('phoneSms.compose.uploadBar')} />}
      {line !== null && <p className="ch-compose-line" role="status">{line}</p>}

      <input ref={picker} type="file" multiple className="ch-picker" tabIndex={-1} aria-label={t('phoneSms.compose.pickFile')}
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; attach(files); }} />

      {menu?.kind === 'attach' && (
        <PopMenu anchor={menu.anchor} from={menu.from} label={t('phoneSms.compose.attach')} onClose={() => setMenu(null)} items={[
          ...(coarsePointer() ? [{ label: t('phoneSms.compose.takePhoto'), icon: 'camera' as const, onSelect: () => choose('image/*', true) }] : []),
          { label: t('phoneSms.compose.photos'), icon: 'image', onSelect: () => choose('image/*,video/*') },
          ...(linkable ? [{ label: t('phoneSms.compose.fileAsLink'), icon: 'file' as const, onSelect: () => choose('') }] : [])
        ]} />
      )}
      {menu?.kind === 'send' && (
        <PopMenu anchor={menu.anchor} from={menu.from} label={t('phoneSms.compose.sending')} onClose={() => setMenu(null)} items={[
          { label: t('phoneSms.compose.laterDots'), icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {planning && (
        <PlanDialog onClose={() => setPlanning(false)} onPlan={(at) => void schedule(at)}
          note={t('phoneSms.compose.planNote')} />
      )}
    </form>
  );
}
