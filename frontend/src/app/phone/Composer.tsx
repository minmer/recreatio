/**
 * DAS SCHREIBFELD einer SMS (MMS mit Bild oder an eine Gruppe) — im Gespräch,
 * in „Nowa wiadomość" und im Blatt „Napisz SMS" (`SmsSheet`). Es sendet selbst
 * (`Phone.send`); wer es zeigt, erfährt nur, in welches Gespräch es ging.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { WorkspaceError } from '../core/session';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Phone, type PhoneStatus } from './native';
import { smsParts } from './numbers';

interface Attachment { readonly type: string; readonly data: string; readonly name: string; readonly preview: string }

const readFile = (file: File): Promise<Attachment> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    resolve({ type: file.type || 'application/octet-stream', data: url.slice(url.indexOf(',') + 1), name: file.name, preview: url });
  };
  reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
  reader.readAsDataURL(file);
});

export function Composer({ to, sims, defaultSub, disabled, onSent, initial = '', separate = false, media = true }: {
  to: readonly string[];
  sims: PhoneStatus['sims'];
  defaultSub: number | null;
  disabled: boolean;
  onSent: (threadId: string) => void;
  initial?: string;
  /** Mehrere Empfänger, jeder für sich (eine SMS je Mensch) statt einer Gruppe. */
  separate?: boolean;
  /** Ein Bild anhängen (MMS) — im Blatt „Napisz SMS" nicht. */
  media?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sub, setSub] = useState<number | null>(defaultSub);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { setSub(defaultSub); }, [defaultSub]);
  useEffect(() => {
    const el = field.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 192)}px`;
  }, [text]);

  const count = smsParts(text);
  const group = to.length > 1 && !separate;
  const mms = attachment !== null || group;
  const send = async () => {
    if (busy || to.length === 0 || (text.trim() === '' && attachment === null)) return;
    setBusy(true);
    try {
      const { threadId } = await Phone.send({
        to, body: text, subId: sub, group,
        attachment: attachment === null ? null : { type: attachment.type, data: attachment.data, name: attachment.name }
      });
      setText('');
      setAttachment(null);
      onSent(threadId);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file === undefined) return;
    void readFile(file).then(setAttachment).catch(() => toast('Nie udało się odczytać pliku.'));
  };

  return (
    <div className="ph-composer">
      {attachment !== null && (
        <div className="ph-attached">
          {attachment.type.startsWith('image/') ? <img src={attachment.preview} alt="" /> : <span>📎 {attachment.name}</span>}
          <button type="button" className="wk-link-btn" onClick={() => setAttachment(null)}>Usuń załącznik</button>
        </div>
      )}
      <div className="ph-composer-row">
        {media && (
          <label className="wk-icon-btn" aria-label="Dodaj zdjęcie (MMS)" title="Dodaj zdjęcie (MMS)">
            <Icon name="image" />
            <input className="ph-attach-input" type="file" accept="image/*,video/*,audio/*" onChange={pick} disabled={disabled || busy} />
          </label>
        )}
        <textarea ref={field} rows={1} value={text} placeholder={disabled ? 'Najpierw ustaw tę aplikację jako aplikację SMS' : mms ? 'MMS' : 'SMS'}
          aria-label="Treść wiadomości" disabled={disabled} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="wk-btn" disabled={disabled || busy || (text.trim() === '' && attachment === null)} onClick={() => void send()}>
          <Icon name="send" />{busy ? 'Wysyłanie…' : 'Wyślij'}
        </button>
      </div>
      <div className="ph-composer-info">
        {!mms && text !== '' && <span>{count.parts > 1 ? `${count.parts} SMS · ` : ''}zostało {count.left}{count.unicode ? ' (polskie znaki: 70 na SMS)' : ''}</span>}
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
