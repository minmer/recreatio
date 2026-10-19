/**
 * 2026-10-18 — DER RAHMEN DES LABORS (Fizyka): oben der Titel
 * und die Werkzeuge der Zeit, darunter die Bühne (eine Leinwand) und daneben
 * — oder auf dem Telefon darunter — die Bedienung.
 *
 * <b>Vollbild</b>: ein Knopf holt das Labor auf den ganzen Bildschirm — mit
 * dem Vollbild des Browsers, wo es das gibt (Android, Schreibtisch), sonst
 * als Ebene über der Seite (iPhone). Im Vollbild gehören alle Gesten dem
 * Labor (ein Finger verschiebt, zwei zoomen); auf der Seite rollt ein Finger
 * über leerem Grund die Seite weiter.
 */

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from '../ui/icons';

import './lab.css';

/** Ob das Labor gerade das ganze Fenster hat — die Leinwand fragt es (Gesten, Rad). */
export const LabFull = createContext(false);

export function LabFrame({ title, chips, bar, stage, side, note, whole = false }: {
  title: string;
  /** Kleine Hinweise neben dem Titel („Piaskownica”, „Doświadczenie”). */
  chips?: ReactNode;
  /** Die Werkzeuge der Zeit (Start, Pause, Od nowa …). */
  bar: ReactNode;
  stage: ReactNode;
  side: ReactNode;
  /** Eine Meldung über der Bühne (Ziel erreicht, ein Hinweis). */
  note?: ReactNode;
  /** Steht schon im ganzen Fenster der Seite (der Baustein im Vollbild). */
  whole?: boolean;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);

  /* Das Vollbild des Browsers verlassen (Esc, Wischgeste): dann auch hier. */
  useEffect(() => {
    const onChange = () => { if (document.fullscreenElement === null && full) setFull(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [full]);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('lab-lock');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('lab-lock'); };
  }, [full]);

  const toggle = useCallback(() => {
    const node = root.current;
    if (full) {
      setFull(false);
      if (document.fullscreenElement !== null) void document.exitFullscreen?.().catch(() => undefined);
      return;
    }
    setFull(true);
    void node?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
  }, [full]);

  return (
    <LabFull.Provider value={full || whole}>
      <div ref={root} className={`lab${full ? ' is-full' : ''}${whole ? ' is-whole' : ''}`}>
        <header className="lab-bar">
          <strong className="lab-title">{title}</strong>
          {chips}
          <span className="lab-bar-tools" role="toolbar" aria-label="Sterowanie">{bar}</span>
          <button type="button" className="lab-tool" aria-label={full ? 'Zamknij pełny ekran' : 'Pełny ekran'} title={full ? 'Zamknij pełny ekran (Esc)' : 'Pełny ekran'} onClick={toggle}>
            <Icon name={full ? 'x' : 'fit'} />
          </button>
        </header>
        <div className="lab-body">
          <div className="lab-stage">
            {stage}
            {note}
          </div>
          <aside className="lab-side">{side}</aside>
        </div>
      </div>
    </LabFull.Provider>
  );
}

/** Ein Werkzeug als Zeichen mit Namen (für Vorleser und Maus). */
export function LabTool({ icon, label, onClick, on = false, disabled = false, text }: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
  on?: boolean;
  disabled?: boolean;
  /** Ein Wort neben dem Zeichen (wo Platz ist). */
  text?: string;
}) {
  return (
    <button type="button" className={`lab-tool${on ? ' is-on' : ''}${text === undefined ? '' : ' has-text'}`} aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
      {text !== undefined && <span>{text}</span>}
    </button>
  );
}

/** Ein Abschnitt der Bedienung mit kleinem Kopf. */
export function LabSection({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="lab-section" open={open}>
      <summary>{title}</summary>
      <div className="lab-section-body">{children}</div>
    </details>
  );
}

/** Eine Zeile Wert: „Masa 2,4 kg”. */
export function LabValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="lab-value">
      <span>{label}</span>
      <output>{value}</output>
    </div>
  );
}

/** Eine Zahl mit Komma und Einheit (U+00A0 dazwischen). */
export function labNum(value: number, digits: number, unit = ''): string {
  if (!Number.isFinite(value)) return '–';
  const n = value.toFixed(digits).replace('-', '−').replace('.', ',');
  return unit === '' ? n : /^[°%]/.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}
