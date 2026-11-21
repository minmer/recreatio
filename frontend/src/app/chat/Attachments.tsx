/**
 * Anhänge in einer Nachricht: Bild und Film, Ton und Sprachnachricht, Datei — geholt und geöffnet erst auf Wunsch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { saveBlob } from '../core/platform';
import { useT } from '../core/i18n';
import { Modal } from '../ui/Modal';
import type { Attachment } from './chat';
import { downloadAttachment } from './chatFeatures';
import { Icon, cls, failure, sizeOf } from './ChatKit';
import { clock as playClock, play as playSound, seek as seekSound, toggle as toggleSound, useNowPlaying } from './mediaPlayer';

/* -- Anhänge -------------------------------------------------------------------------- */

/** Bis zu dieser Grösse öffnen sich Bilder und Sprachnachrichten von selbst, sobald sie ins Bild kommen. */
const AUTO_BYTES = 6 * 1024 * 1024;

export const kindOf = (a: Attachment): 'image' | 'audio' | 'video' | 'file' =>
  /^image\/(png|jpeg|gif|webp|avif)$/.test(a.type) ? 'image'
  : a.type.startsWith('audio/') ? 'audio'
  : a.type.startsWith('video/') || (a.type === '' && /\.(mp4|m4v|mov|webm|3gp)$/i.test(a.name)) ? 'video'
  : 'file';

const isVoice = (a: Attachment) => a.name.startsWith('voice-');

/** Ein Anhang, im Browser entschlüsselt — auf Wunsch, oder von selbst, sobald er zu sehen ist. */
function useOpenedFile(endpoint: string, a: Attachment, auto: boolean) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* 2026-11-21 — wie weit das Holen ist (0 … 1): ein grosser Film braucht seine Zeit. */
  const [progress, setProgress] = useState<number | null>(null);
  const spot = useRef<HTMLElement | null>(null);
  const alive = useRef(true);
  const made = useRef<{ url: string; blob: Blob } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (made.current !== null) { URL.revokeObjectURL(made.current.url); made.current = null; }
    };
  }, []);

  const load = useCallback(async (): Promise<Blob | null> => {
    if (made.current !== null) return made.current.blob;
    setBusy(true);
    setFailed(null);
    setProgress(null);
    try {
      let shown = -1;
      const blob = await downloadAttachment(endpoint, a, (part) => {
        const percent = Math.floor(part * 100);
        if (alive.current && percent !== shown) { shown = percent; setProgress(part); }
      });
      if (!alive.current) return null;
      /* Ein Film vom iPhone (.mov, meist H.264) spielt in Firefox und Chrome als MP4 — zum Speichern bleibt er, wie er war. */
      const shownBlob = a.type === 'video/quicktime' || (a.type === '' && kindOf(a) === 'video') ? new Blob([blob], { type: 'video/mp4' }) : blob;
      const made1 = { url: URL.createObjectURL(shownBlob), blob };
      made.current = made1;
      setUrl(made1.url);
      return blob;
    } catch (e) {
      if (alive.current) setFailed(failure(e, t('chat.file.downloadFailed')));
      return null;
    } finally {
      if (alive.current) { setBusy(false); setProgress(null); }
    }
  }, [endpoint, a, t]);

  useEffect(() => {
    const el = spot.current;
    if (!auto || el === null || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver((seen) => {
      if (seen.some((s) => s.isIntersecting)) { watch.disconnect(); void load(); }
    }, { rootMargin: '300px' });
    watch.observe(el);
    return () => watch.disconnect();
  }, [auto, load]);

  const save = async () => {
    const blob = await load();
    if (blob !== null) await saveBlob(blob, a.name).catch(() => setFailed(t('chat.file.saveFailed')));
  };

  /** Was beim Holen dasteht: „Pobieranie 34%”, dann „Odszyfrowywanie…”. */
  const status = progress !== null && progress < 1 ? t('chat.file.downloading', { percent: Math.floor(progress * 100) }) : t('chat.file.decrypting');

  return { url, busy, failed, load, save, spot, status };
}

/**
 * 2026-11-21 — EIN FILM: spielen, und speichern (vorher gab es für Filme keinen Weg
 * zum Speichern). Spielt ihn der Browser nicht, steht das da — mit demselben Knopf.
 */
function ChatVideo({ a, url, save, busy, failed }: { a: Attachment; url: string; save: () => Promise<void>; busy: boolean; failed: string | null }) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  return (
    <div className="ch-video-box">
      {!broken && <video className="ch-video" controls playsInline preload="metadata" src={url} aria-label={a.name} onError={() => setBroken(true)} />}
      {broken && <p className="wk-warn">{t('chat.file.videoUnplayable')}</p>}
      <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void save()}>
        <Icon name="download" /> {t('chat.file.saveVideo', { size: sizeOf(a.size) })}
      </button>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

export function Attachments({ endpoint, list }: { endpoint: string; list: readonly Attachment[] }) {
  const media = list.filter((a) => kindOf(a) === 'image' || kindOf(a) === 'video');
  const rest = list.filter((a) => !media.includes(a));
  return (
    <div className="ch-atts">
      {media.length > 0 && (
        <div className={cls('ch-media', media.length > 1 && 'is-grid')}>
          {media.map((a) => <Media key={a.id} endpoint={endpoint} a={a} />)}
        </div>
      )}
      {rest.map((a) => (kindOf(a) === 'audio'
        ? <Sound key={a.id} endpoint={endpoint} a={a} />
        : <FileRow key={a.id} endpoint={endpoint} a={a} />))}
    </div>
  );
}

function Media({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const t = useT();
  const image = kindOf(a) === 'image';
  const file = useOpenedFile(endpoint, a, image && a.size <= AUTO_BYTES);
  const [zoom, setZoom] = useState(false);

  if (file.url === null) {
    return (
      <button type="button" className="ch-media-slot" ref={(el) => { file.spot.current = el; }} disabled={file.busy}
        onClick={() => void file.load()} aria-label={t(image ? 'chat.file.showPhoto' : 'chat.file.playVideo', { name: a.name, size: sizeOf(a.size) })}>
        <Icon name={image ? 'image' : 'play'} />
        <span>{file.busy ? file.status : file.failed ?? t(image ? 'chat.file.photoSize' : 'chat.file.videoSize', { size: sizeOf(a.size) })}</span>
      </button>
    );
  }

  if (!image) return <ChatVideo a={a} url={file.url} save={file.save} busy={file.busy} failed={file.failed} />;

  return (
    <>
      <button type="button" className="ch-photo" onClick={() => setZoom(true)} aria-label={t('chat.file.zoom', { name: a.name })}>
        <img src={file.url} alt={a.name} />
      </button>
      {zoom && (
        <Modal title={a.name} wide onClose={() => setZoom(false)}>
          <img className="ch-zoom" src={file.url} alt={a.name} />
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void file.save()}>{t('chat.file.savePhoto')}</button>
            <span className="wk-hint">{sizeOf(a.size)}</span>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * EIN TON — über den EINEN Spieler der App (`mediaPlayer`): er spielt weiter,
 * wenn man die Rozmowa verlässt oder die App in den Hintergrund legt; oben in
 * der Kopfleiste steht dann, was spielt (`NowPlayingBar`).
 */
function Sound({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const t = useT();
  const file = useOpenedFile(endpoint, a, a.size <= AUTO_BYTES);
  const voice = isVoice(a);
  const now = useNowPlaying();
  const mine = now?.key === a.id ? now : null;
  const title = voice ? t('chat.file.voice') : a.name;

  const start = async () => {
    if (mine !== null) { toggleSound(); return; }
    const blob = await file.load();
    if (blob !== null) playSound({ key: a.id, title, blob });
  };

  return (
    <div className="ch-sound" ref={(el) => { file.spot.current = el; }}>
      <span className="ch-sound-head">
        <Icon name={voice ? 'mic' : 'music'} />
        <span className="ch-file-name">{title}</span>
        <small>{sizeOf(a.size)}</small>
      </span>
      <span className="ch-sound-play">
        <button type="button" className="ch-icon-btn" disabled={file.busy} data-sound-play=""
          aria-label={mine?.playing === true ? t('chat.player.pause') : t('chat.player.play')} title={mine?.playing === true ? t('chat.player.pause') : t('chat.player.play')}
          onClick={() => void start()}>
          <Icon name={mine?.playing === true ? 'pause' : 'play'} />
        </button>
        <input type="range" min={0} max={1000} step={1} aria-label={t('chat.player.position')} disabled={mine === null || mine.duration === null}
          value={mine !== null && mine.duration ? Math.round((mine.time / mine.duration) * 1000) : 0}
          onChange={(e) => seekSound(Number(e.target.value) / 1000)} />
        <span className="ch-sound-time">
          {file.busy ? file.status : mine !== null ? `${playClock(mine.time)} / ${playClock(mine.duration)}` : ''}
        </span>
      </span>
      {file.failed !== null && <span className="wk-error">{file.failed}</span>}
    </div>
  );
}

function FileRow({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const t = useT();
  const file = useOpenedFile(endpoint, a, false);
  return (
    <button type="button" className="ch-file" disabled={file.busy} onClick={() => void file.save()} title={t('chat.file.downloadName', { name: a.name })}>
      <span className="ch-file-ic"><Icon name={file.busy ? 'clock' : 'download'} /></span>
      <span className="ch-file-text">
        <span className="ch-file-name">{a.name}</span>
        <small>{file.failed ?? (file.busy ? file.status : t('chat.file.sizeDownload', { size: sizeOf(a.size) }))}</small>
      </span>
    </button>
  );
}
