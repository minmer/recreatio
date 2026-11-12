/**
 * 2026-11-12 (Eigentümer: „wenn das Modul geladen ist, ist alles darin grau, und die Hauptfrage: im Vollbild öffnen, als ganze
 * Seite öffnen oder nur als Teil der Seite verwenden — und dabei zum Vollbild oder zur ganzen Seite drängen") — DIE EINLADUNG:
 * beim Laden liegt über der Karte ein grauer Schleier mit drei Wegen; der Vollbild-Weg ist der grosse, empfohlene, die ganze
 * Seite der zweite, „als Teil der Seite" nur ein Link. Die Wahl gilt, solange das Modul offen ist (beim nächsten Laden fragt es
 * wieder). Esc = als Teil der Seite.
 *
 * In der Vorschau (`preview.html`: Klickpfade, das MCP der Vorschau) fragt sie nur mit `?invite=1` — sonst stünde sie vor jedem Bild.
 */

import { useEffect, useRef } from 'react';

import type { T } from '../../core/i18n';
import './worldmap.css';

export function inviteWanted(): boolean {
  if (typeof window === 'undefined') return false;
  const preview = (window as { recreatioPreview?: unknown }).recreatioPreview !== undefined || window.location.pathname.endsWith('/preview.html');
  return !preview || new URLSearchParams(window.location.search).get('invite') === '1';
}

export function WorldInvite({ t, onScreen, onPage, onStay, compact }: { t: T; onScreen: () => void; onPage: () => void; onStay: () => void; compact: boolean }) {
  const first = useRef<HTMLButtonElement | null>(null);
  const stayRef = useRef(onStay);
  stayRef.current = onStay;
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); stayRef.current(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className={`cg-wm-openask${compact ? ' is-compact' : ''}`} role="dialog" aria-modal="false" aria-labelledby="cg-wm-openask-head" data-world-invite="">
      <div className="cg-wm-askcard">
        <h2 id="cg-wm-openask-head" className="cg-wm-askhead">{t('cogitaWorld.invite.title')}</h2>
        <p className="cg-wm-asksays">{t('cogitaWorld.invite.says')}</p>
        <div className="cg-wm-askways">
          <button ref={first} type="button" className="cg-wm-askway is-best" onClick={onScreen} data-world-invite-choose="screen">
            <span className="cg-wm-askicon" aria-hidden="true">⛶</span>
            <span className="cg-wm-asktext">
              <strong>{t('cogitaWorld.invite.screen')}</strong>
              <span>{t('cogitaWorld.invite.screenSays')}</span>
            </span>
            <span className="cg-wm-askbest">{t('cogitaWorld.invite.best')}</span>
          </button>
          <button type="button" className="cg-wm-askway" onClick={onPage} data-world-invite-choose="page">
            <span className="cg-wm-askicon" aria-hidden="true">▣</span>
            <span className="cg-wm-asktext">
              <strong>{t('cogitaWorld.invite.page')}</strong>
              <span>{t('cogitaWorld.invite.pageSays')}</span>
            </span>
          </button>
        </div>
        <button type="button" className="wk-link-btn cg-wm-askstay" onClick={onStay} data-world-invite-choose="stay">{t('cogitaWorld.invite.stay')}</button>
      </div>
    </div>
  );
}
