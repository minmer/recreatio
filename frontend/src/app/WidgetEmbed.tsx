/**
 * OSADŹ NA INNEJ STRONIE (0067) — der Code für ein Widget dieses Bausteins.
 *
 * Für WordPress: Block „Własny HTML", Code hinein, fertig. Das Widget zeigt,
 * was jeder Besucher dieser Seite sieht (Msze, Intencje, Kalendarz …); ein
 * Klick führt auf recreatio.pl.
 */

import { useEffect, useState } from 'react';

import { API } from './session';
import { embedCode } from './Widget';

const SIZES: readonly { w: string; h: string; label: string }[] = [
  { w: 'wide', h: 'block', label: 'Szeroki blok' },
  { w: 'narrow', h: 'tall', label: 'Wąska kolumna (pasek boczny)' },
  { w: 'full', h: 'tall', label: 'Cała szerokość, wysoki' },
  { w: 'wide', h: 'strip', label: 'Pasek' }
];

export function WidgetEmbed({ path, partId, title }: {
  path: string | null;
  partId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  /* Sieht ein Besucher OHNE Konto die Seite? Gefragt wie er: ohne Keks. */
  const [publicPage, setPublicPage] = useState(true);
  useEffect(() => {
    if (!open || path === null) return;
    let alive = true;
    void fetch(`${API}/page/${path.split('/').map(encodeURIComponent).join('/')}`, { credentials: 'omit' })
      .then((r) => { if (alive) setPublicPage(r.ok); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [open, path]);
  const [size, setSize] = useState(0);
  const [copied, setCopied] = useState(false);

  if (path === null) return null;
  if (!open) {
    return (
      <button type="button" className="wk-link-btn" onClick={() => setOpen(true)}>Osadź na innej stronie (np. WordPress)…</button>
    );
  }

  const code = embedCode(path, partId, title, SIZES[size]);

  return (
    <section className="wk-embed">
      <h4 className="pb-h">Widżet na innej stronie</h4>
      {!publicPage && (
        <p className="wk-warn">Ta strona jest tylko z dostępem — widżet pokaże tylko to, co widzi każdy, czyli nic. Udostępnij stronę wszystkim, żeby widżet działał.</p>
      )}
      <label className="wk-field">
        <span>Kształt</span>
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>Kod do wklejenia (WordPress: blok „Własny HTML")</span>
        <textarea readOnly rows={5} value={code} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? 'Skopiowano' : 'Kopiuj kod'}</button>
        <a className="wk-link-btn" href={code.match(/src="([^"]+)"/)?.[1] ?? '#'} target="_blank" rel="noopener">Podgląd</a>
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>Zamknij</button>
      </div>
      <p className="wk-hint">Widżet pokazuje dane na żywo; kliknięcie prowadzi na recreatio.pl. Wysokość dopasowuje się sama dzięki skryptowi widget.js.</p>
    </section>
  );
}

export default WidgetEmbed;
