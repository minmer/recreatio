import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryCopyStrings } from './libraryCopy';
import { Modal } from './libraryComponents';

// The BarcodeDetector API is not in lib.dom yet. Only the slice used here is
// declared; everything is feature-detected before use.
type DetectedBarcode = { rawValue: string; format: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const BOOK_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** Cameras are only reachable over https (or localhost). */
function cameraAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (typeof window === 'undefined' || window.isSecureContext)
  );
}

/**
 * Keeps only the characters an ISBN can contain. Handheld scanners sometimes
 * append a newline or a stray separator.
 */
function cleanCode(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

/**
 * Barcode entry with two paths that matter in practice:
 *  - typing, which also covers USB "wedge" scanners that behave like keyboards
 *    and send Enter at the end — the fastest way to catalogue a whole shelf;
 *  - the device camera through BarcodeDetector, where the browser supports it.
 */
export function BarcodeScannerDialog({
  t,
  title,
  onClose,
  onDetected
}: {
  t: LibraryCopyStrings;
  title: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);

  const detectorSupported = getBarcodeDetector() !== null;
  const canUseCamera = detectorSupported && cameraAvailable();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const code = cleanCode(raw);
      if (code.length < 8) return;
      if (detectedRef.current) return;
      detectedRef.current = true;
      stopCamera();
      onDetected(code);
    },
    [onDetected, stopCamera]
  );

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!cameraOn || !canUseCamera) return;

    let cancelled = false;
    let timer = 0;

    const run = async () => {
      const Detector = getBarcodeDetector();
      if (!Detector) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }

        const detector = new Detector({ formats: BOOK_FORMATS });
        const tick = async () => {
          if (cancelled || detectedRef.current) return;
          const source = videoRef.current;
          if (source && source.readyState >= 2) {
            try {
              const results = await detector.detect(source);
              const hit = results.find((result) => cleanCode(result.rawValue).length >= 8);
              if (hit) {
                submit(hit.rawValue);
                return;
              }
            } catch {
              // A single failed frame is normal while focusing; keep polling.
            }
          }
          timer = window.setTimeout(tick, 250);
        };

        timer = window.setTimeout(tick, 300);
      } catch {
        if (!cancelled) {
          setCameraError(t.scan.cameraDenied);
          setCameraOn(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [cameraOn, canUseCamera, stopCamera, submit, t.scan.cameraDenied]);

  return (
    <Modal
      title={title}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      footer={
        <>
          <button
            type="button"
            className="lib-btn lib-btn-ghost"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            {t.common.cancel}
          </button>
          <button type="button" className="lib-btn" disabled={cleanCode(manual).length < 8} onClick={() => submit(manual)}>
            {t.scan.lookUp}
          </button>
        </>
      }
    >
      <div className="lib-scan">
        <label className="lib-field">
          <span className="lib-field-label">{t.scan.manualLabel}</span>
          <input
            className="lib-input lib-scan-input"
            value={manual}
            inputMode="numeric"
            autoFocus
            placeholder="978…"
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              // Handheld scanners finish with Enter.
              if (event.key === 'Enter') {
                event.preventDefault();
                submit(manual);
              }
            }}
          />
          <span className="lib-field-hint">{t.scan.manualHint}</span>
        </label>

        {canUseCamera ? (
          <div className="lib-scan-camera">
            {cameraOn ? (
              <>
                <video ref={videoRef} className="lib-scan-video" playsInline muted />
                <p className="lib-muted">{t.scan.aimHint}</p>
                <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setCameraOn(false)}>
                  {t.scan.stopCamera}
                </button>
              </>
            ) : (
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setCameraOn(true)}>
                {t.scan.useCamera}
              </button>
            )}
            {cameraError ? <p className="lib-warn">{cameraError}</p> : null}
          </div>
        ) : (
          <p className="lib-muted">
            {detectorSupported ? t.scan.cameraInsecure : t.scan.cameraUnsupported}
          </p>
        )}
      </div>
    </Modal>
  );
}
