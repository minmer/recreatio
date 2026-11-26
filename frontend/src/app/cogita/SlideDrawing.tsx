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
 *
 * 2026-11-26 — dazu eine GRAFIK DER BAZA ("drawing": "@atom" oder { "graphic": "@atom", "add" … }, `slideGraphics.ts`). Zeigte die
 * vorige Folie dieselbe (`continued`), kommt nur der Text neu — das Bild bleibt stehen und gleitet in seinen neuen Stand.
 */

import { useMemo, type ReactNode } from 'react';

import { drawingOfText } from './interactive';
import type { PublicEntity } from './publish';
import type { CogitaLibrary } from './store';
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

/** Eine Grafik der Baza aus ihrer Kennung, ihrem bleibenden Namen ("@atom") oder ihrem Namen — mit ihrem Bild. */
export function graphicLookup(lib: CogitaLibrary): (ref: string) => { readonly id: string; readonly drawing: Record<string, unknown> } | null {
  return (ref) => {
    const r = ref.trim();
    const list = lib.docs('graphic');
    const name = r.startsWith('@') ? r.slice(1) : r;
    const hit = list.find((e) => e.id === r) ?? (r.startsWith('@') ? lib.byImportRef(name, 'graphic') : undefined)
      ?? list.find((e) => String(e.data.name ?? '').trim().toLowerCase() === name.toLowerCase());
    const d = hit?.data.drawing;
    if (hit === undefined) return null;
    if (typeof d === 'object' && d !== null && !Array.isArray(d)) return { id: hit.id, drawing: d as Record<string, unknown> };
    if (typeof d === 'string') { try { const v = JSON.parse(d) as unknown; if (typeof v === 'object' && v !== null && !Array.isArray(v)) return { id: hit.id, drawing: v as Record<string, unknown> }; } catch { /* kaputt */ } }
    return null;
  };
}

/** Text und Bild nebeneinander (`text` links); ohne brauchbares Bild nur der Text — und ein Hinweis, warum. */
export function WithSlideDrawing({ text, identity, children, broken, continued = false, graphic = null }: { text: string | null; identity: string; children: ReactNode; broken: string; continued?: boolean; graphic?: string | null }) {
  const drawing = useMemo(() => (text === null ? null : drawingOfText(text)), [text]);
  if (text === null) return <>{children}</>;
  return (
    <div className={`cg-slide-pair${continued ? ' is-continued' : ''}`} data-slide-drawing={drawing === null ? 'broken' : 'ok'} data-slide-graphic={graphic ?? ''} data-slide-continued={continued ? '1' : '0'}>
      <div className="cg-slide-pair-grid">
        <div className="cg-slide-pair-text">{children}</div>
        <figure className="cg-slide-pair-drawing">
          {drawing === null ? <p className="wk-note">{broken}</p> : <Live drawing={drawing} identity={identity} />}
        </figure>
      </div>
    </div>
  );
}
