/**
 * OSADŹ NA INNEJ STRONIE (0067) — der Code für ein Widget dieses Bausteins.
 *
 * Für WordPress: Block „Własny HTML", Code hinein, fertig. Das Widget zeigt,
 * was jeder Besucher dieser Seite sieht (Msze, Intencje, Kalendarz …); ein
 * Klick führt auf recreatio.pl.
 */

import { useEffect, useState } from 'react';

import { API } from '../core/session';
import { embedCode } from './Widget';
import { useT } from '../core/i18n';

const SIZES: readonly { w: string; h: string; label: string }[] = [
  { w: 'wide', h: 'block', label: 'pages.embed.wideBlock' },
  { w: 'narrow', h: 'tall', label: 'pages.embed.narrow' },
  { w: 'full', h: 'tall', label: 'pages.embed.fullTall' },
  { w: 'wide', h: 'strip', label: 'pages.embed.strip' }
];

export function WidgetEmbed({ path, partId, title }: {
  path: string | null;
  partId: string;
  title: string;
}) {
  const t = useT();
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
      <button type="button" className="wk-link-btn" onClick={() => setOpen(true)}>{t('pages.embed.open')}</button>
    );
  }

  const code = embedCode(path, partId, title, SIZES[size]);

  return (
    <section className="wk-embed">
      <h4 className="pb-h">{t('pages.embed.title')}</h4>
      {!publicPage && (
        <p className="wk-warn">{t('pages.embed.notPublic')}</p>
      )}
      <label className="wk-field">
        <span>{t('pages.embed.shape')}</span>
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {SIZES.map((s, i) => <option key={s.label} value={i}>{t(s.label)}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{t('pages.embed.code')}</span>
        <textarea readOnly rows={5} value={code} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? t('pages.embed.copied') : t('pages.embed.copy')}</button>
        <a className="wk-link-btn" href={code.match(/src="([^"]+)"/)?.[1] ?? '#'} target="_blank" rel="noopener">{t('pages.embed.preview')}</a>
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>{t('common.close')}</button>
      </div>
      <p className="wk-hint">{t('pages.embed.hint')}</p>
    </section>
  );
}

export default WidgetEmbed;
