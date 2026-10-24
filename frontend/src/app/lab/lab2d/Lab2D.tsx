/**
 * LABOR 2D (v2) — DER EINSTIEG (seit 2026-10-24): auf der Seite eine Karte
 * mit Titel, erstem Satz der Aufgabe und „Otwórz laboratorium“. Das Labor
 * selbst (LabApp.tsx) läuft nur im ganzen Bildschirm: als Ebene über der Seite
 * mit dem Vollbild des Browsers, wo es das gibt, und ohne dass hinter ihm
 * etwas rollt. Im ganzen Fenster der Seite (whole) füllt es dieses Fenster
 * gleich, ohne Karte.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../../ui/icons';
import { t } from './i18n';
import { LabApp } from './LabApp';
import { createGpuWorker, createLabWorker } from './workerFactory';

/* Die Felder (Gegenstand, Inspektor, Schreiber) nutzen die Klassen des Rahmens der Labore. */
import '../lab.css';
import './lab2d.css';

/** Ein Szenariusz zur Wahl: Titel, Text für die Schüler, Szene. */
export interface Lab2DScenario {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

export interface Lab2DConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
  /** Beim Öffnen: nichts tun (Knöpfe) oder gleich backen ('bake'). */
  readonly start?: 'button' | 'bake';
  /** Länge eines Nachweises beim Backen (s). */
  readonly seconds?: number;
  /** Weitere Szenariusze neben der eigenen Szene. */
  readonly scenarios?: readonly Lab2DScenario[];
}

/** Die Ebene über der Seite: das ganze Fenster, das Vollbild des Browsers, wo es geht; die Seite dahinter rollt nicht. */
function Layer({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    document.body.classList.add('l2d-lock');
    void ref.current?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    return () => {
      document.body.classList.remove('l2d-lock');
      if (document.fullscreenElement !== null) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);
  return createPortal(<div ref={ref} className="l2d-layer" role="dialog" aria-modal="true" aria-label={label}>{children}</div>, document.body);
}

/** Das Bild der Karte: eine Zlewka mit Wasser auf der Platte, ein paar Blasen. */
function CardArt() {
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <rect x="18" y="66" width="84" height="8" rx="2" className="l2d-art-plate" />
      <path d="M38 14v52h44V14" className="l2d-art-glass" />
      <rect x="39.5" y="34" width="41" height="31" className="l2d-art-water" />
      <circle cx="52" cy="56" r="2.6" className="l2d-art-bubble" />
      <circle cx="64" cy="47" r="3.4" className="l2d-art-bubble" />
      <circle cx="58" cy="39" r="2" className="l2d-art-bubble" />
      <path d="M50 10c3-4 0-6 3-9M62 10c3-4 0-6 3-9" className="l2d-art-steam" />
    </svg>
  );
}

export function Lab2D({ config, whole = false, createWorker = createLabWorker, createAccelWorker = createGpuWorker }: {
  config: Lab2DConfig;
  whole?: boolean;
  createWorker?: () => Worker;
  /** Der Arbeiter des beschleunigten Wegs (WebGPU). */
  createAccelWorker?: () => Worker;
}) {
  const [open, setOpen] = useState(false);
  const title = config.title || t('title');
  if (whole) return <div className="l2d-whole"><LabApp config={config} createWorker={createWorker} createAccelWorker={createAccelWorker} /></div>;
  return (
    <>
      <div className="l2d-card">
        <div className="l2d-card-art"><CardArt /></div>
        <div className="l2d-card-text">
          <strong>{title}</strong>
          {config.text[0] !== undefined && <p>{config.text[0]}</p>}
        </div>
        <button type="button" className="l2d-btn is-primary" onClick={() => setOpen(true)}><Icon name="fit" />{t('openLab')}</button>
      </div>
      {open && (
        <Layer label={title}>
          <LabApp config={config} createWorker={createWorker} createAccelWorker={createAccelWorker} onClose={() => setOpen(false)} />
        </Layer>
      )}
    </>
  );
}
