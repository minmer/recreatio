/**
 * 2026-11-05 (Prompt 23, D1) — EIN RYSUNEK NEBEN DEM TEXT EINER FOLIE (ein Schritt „show"): dasselbe JSON wie der Baustein
 * „Animacja" einer Seite und eine Frage „interactive" — still oder mit Schiebern, ohne Ziel und ohne Wertung.
 * <code>
 *   "drawing": {…}           das Bild selbst im Schritt (vars, let, controls, elements …)
 *   "drawing": "{…}"         dasselbe als JSON-Text
 *   "drawing": "rysunek"     der Name eines Feldes des gezeigten Eintrags (Typ "json" oder "text"), das das Bild trägt
 * </code>
 * Breit (ab 34rem): der Text links, das Bild rechts; schmal (Telefon): untereinander. Das Bild kommt erst, wenn eine solche Folie gezeigt
 * wird.
 */

import { useMemo, type ReactNode } from 'react';

import { drawingOfText } from './interactive';
import type { PublicEntity } from './publish';
import { later } from '../ui/later';
import './slideDrawing.css';

const Live = later(() => import('../pages/motion/LiveDrawing').then((m) => m.LiveDrawing));

/** Der Text des Bildes aus der Einstellung des Schrittes (und dem gezeigten Eintrag) — `null`: keines. */
export function slideDrawingText(value: unknown, entity: PublicEntity | null): string | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return JSON.stringify(value);
  if (typeof value !== 'string' || value.trim() === '') return null;
  const t = value.trim();
  if (t.startsWith('{')) return t;
  const field = entity?.fields.find((f) => f.key === t || f.label === t);
  return field === undefined || field.text.trim() === '' ? null : field.text.trim();
}

/** Text und Bild nebeneinander (`text` links); ohne brauchbares Bild nur der Text — und ein Hinweis, warum. */
export function WithSlideDrawing({ text, identity, children, broken }: { text: string | null; identity: string; children: ReactNode; broken: string }) {
  const drawing = useMemo(() => (text === null ? null : drawingOfText(text)), [text]);
  if (text === null) return <>{children}</>;
  return (
    <div className="cg-slide-pair" data-slide-drawing={drawing === null ? 'broken' : 'ok'}>
      <div className="cg-slide-pair-grid">
        <div className="cg-slide-pair-text">{children}</div>
        <figure className="cg-slide-pair-drawing">
          {drawing === null ? <p className="wk-note">{broken}</p> : <Live drawing={drawing} identity={identity} />}
        </figure>
      </div>
    </div>
  );
}
