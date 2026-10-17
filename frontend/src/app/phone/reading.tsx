/**
 * MEHRERE NACHRICHTEN AUF EINMAL (2026-10-18) — lange drücken wählt eine, dann
 * wählt jeder kurze Tipp weitere; „Wyświetl" zeigt sie gross (A− / A+, am Konto
 * gemerkt), „Kopiuj" nimmt ihren Text mit. Im Gespräch auf dem Telefon und im
 * Archiv, auch im Browser. Löschen gibt es hier nicht.
 */

import { useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

import { useRemembered } from '../core/prefs';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Fullscreen } from '../ui/Modal';

/** Was der Leser zeigt: wer, wann, was. */
export interface Readable {
  readonly key: string;
  readonly who: string;
  readonly at: number;
  readonly body: string;
}

const LONG_MS = 450;

/**
 * Lange drücken (oder die rechte Maustaste): `onLong`; ein kurzer Tipp: `onTap`.
 * Wer beim Drücken rollt, hat nicht gedrückt.
 */
export function usePress(onLong: () => void, onTap: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      stop();
      timer.current = window.setTimeout(() => { fired.current = true; timer.current = null; onLong(); }, LONG_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current !== null && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (!fired.current) { fired.current = true; stop(); onLong(); }
    },
    onClick: (e: MouseEvent) => {
      if (fired.current) { fired.current = false; e.preventDefault(); return; }
      onTap();
    }
  };
}

const stamp = (at: number) => new Date(at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Der Text der gewählten Nachrichten — zum Einfügen anderswo. */
export function copyReadable(items: readonly Readable[]): void {
  const text = items.map((m) => `${m.who} (${stamp(m.at)}):\n${m.body}`).join('\n\n');
  void navigator.clipboard?.writeText(text).then(() => toast(items.length === 1 ? 'Skopiowano wiadomość.' : `Skopiowano wiadomości: ${items.length}.`))
    .catch(() => toast('Nie udało się skopiować.'));
}

/** Die Leiste, solange gewählt wird — statt des Kopfes des Gesprächs. */
export function SelectionBar({ count, onShow, onCopy, onClear }: { count: number; onShow: () => void; onCopy: () => void; onClear: () => void }) {
  return (
    <div className="ph-thread-head ph-select-bar" role="toolbar" aria-label="Zaznaczone wiadomości">
      <button type="button" className="wk-icon-btn" aria-label="Zakończ zaznaczanie" title="Zakończ zaznaczanie" onClick={onClear}><Icon name="x" /></button>
      <span className="ph-thread-title"><strong className="ph-thread-name">Zaznaczone: {count}</strong></span>
      <button type="button" className="wk-btn wk-btn-quiet" onClick={onCopy}><Icon name="copy" />Kopiuj</button>
      <button type="button" className="wk-btn" onClick={onShow}><Icon name="eye" />Wyświetl</button>
    </div>
  );
}

const SIZES = { min: 0.8, max: 4, step: 0.2 };
const readerStyle = (scale: number) => ({ '--ph-reader-scale': String(scale) } as CSSProperties);

/** DIE GEWÄHLTEN GROSS — zum Lesen, zum Vorzeigen; die Grösse bleibt gemerkt. */
export function MessageReader({ title, items, onClose }: { title: string; items: readonly Readable[]; onClose: () => void }) {
  const [scaleText, setScale] = useRemembered('sms.reader', '1.6');
  const scale = Math.min(SIZES.max, Math.max(SIZES.min, Number(scaleText) || 1.6));
  const change = (by: number) => setScale(String(Math.round(Math.min(SIZES.max, Math.max(SIZES.min, scale + by)) * 10) / 10));
  return (
    <Fullscreen title={title} onClose={onClose}>
      <div className="ph-reader-tools" role="group" aria-label="Wielkość liter">
        <button type="button" className="wk-btn wk-btn-quiet" aria-label="Mniejsze litery" disabled={scale <= SIZES.min} onClick={() => change(-SIZES.step)}>A−</button>
        <span className="ph-reader-size">{Math.round(scale * 100)}%</span>
        <button type="button" className="wk-btn wk-btn-quiet" aria-label="Większe litery" disabled={scale >= SIZES.max} onClick={() => change(SIZES.step)}>A+</button>
        <button type="button" className="wk-btn wk-btn-quiet" onClick={() => copyReadable(items)}><Icon name="copy" />Kopiuj</button>
      </div>
      <div className="ph-reader" style={readerStyle(scale)}>
        {items.map((m) => (
          <article key={m.key} className="ph-reader-msg">
            <header>{m.who} · {stamp(m.at)}</header>
            <p>{m.body}</p>
          </article>
        ))}
      </div>
    </Fullscreen>
  );
}
