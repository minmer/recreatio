/**
 * DER SCANNER — die Kamera auf den Strichcode halten, fertig.
 *
 * Drei Wege, derselbe Ausgang (`onCode`): das laufende Bild der Kamera
 * (gelesen, sobald ein Code darin steht), ein Foto des Codes (wo die Kamera
 * im Browser nicht geht oder nicht erlaubt ist) und das Eintippen der Nummer.
 * Die Kamera geht aus, sobald etwas gefunden ist oder das Fenster zugeht.
 */

import { useEffect, useRef, useState } from 'react';
import { useT } from '../core/i18n';

import { readFrame, readPhoto } from '../library/barcode';
import { Modal } from './Modal';

type CameraState = 'starting' | 'live' | 'denied' | 'none';

export function Scanner({ title, lead, onCode, onClose }: {
  title: string;
  lead: string;
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement | null>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [typed, setTyped] = useState('');
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const done = useRef(false);
  const found = useRef(onCode);
  found.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let alive = true;

    const finish = (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(60);
      stream?.getTracks().forEach((track) => track.stop());
      found.current(code.trim());
    };

    const tick = async () => {
      if (!alive || done.current || video.current === null) return;
      const code = await readFrame(video.current).catch(() => null);
      if (code !== null && code.trim() !== '') { finish(code); return; }
      if (alive) timer = window.setTimeout(() => { void tick(); }, 160);
    };

    void (async () => {
      if (navigator.mediaDevices?.getUserMedia === undefined) { setCamera('none'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (e) {
        if (alive) setCamera(e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'none');
        return;
      }
      if (!alive) { stream.getTracks().forEach((track) => track.stop()); return; }
      /* Scharf auf nahe Dinge — wo das Telefon es kann. */
      const track = stream.getVideoTracks()[0];
      await track?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
      const el = video.current;
      if (el === null) return;
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      setCamera('live');
      void tick();
    })();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const fromPhoto = async (file: File | undefined) => {
    if (file === undefined) return;
    setReading(true);
    setFailed(null);
    const code = await readPhoto(file).catch(() => null);
    setReading(false);
    if (code === null) { setFailed(t('ui.scanner.noCode')); return; }
    done.current = true;
    onCode(code.trim());
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="scan">
        <p className="wk-hint">{lead}</p>
        <div className={`scan-view is-${camera}`}>
          <video ref={video} playsInline muted aria-label={t('ui.scanner.video')} />
          {camera === 'live' && <span className="scan-line" aria-hidden="true" />}
          {camera === 'starting' && <p className="scan-say">{t('ui.scanner.starting')}</p>}
          {camera === 'denied' && <p className="scan-say">{t('ui.scanner.denied')}</p>}
          {camera === 'none' && <p className="scan-say">{t('ui.scanner.none')}</p>}
        </div>
        <div className="wk-actions">
          <label className="wk-btn scan-photo">
            {reading ? t('ui.scanner.reading') : t('ui.scanner.photo')}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <form className="scan-type" onSubmit={(e) => { e.preventDefault(); if (typed.trim() !== '') { done.current = true; onCode(typed.trim()); } }}>
          <label className="wk-field">
            <span>{t('ui.scanner.orType')}</span>
            <input value={typed} inputMode="text" placeholder={t('ui.scanner.placeholder')} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <button type="submit" className="wk-link-btn" disabled={typed.trim() === ''}>{t('common.search')}</button>
        </form>
      </div>
    </Modal>
  );
}
