/**
 * 2026-11-06 — DER ENTWURF EINER SEITE, gezeichnet (`pageStyle.ts`): die Hülle, die ihn anwendet, der Kopf mit
 * Titel, Vorspann und Band, und die kleine Vorschau im Editor der Seite.
 */

import { useLayoutEffect, type CSSProperties, type ReactNode } from 'react';

import { useT } from '../core/i18n';
import { appearance, holdPage } from '../core/theme';
import { hasBand, pageHold, scopedVars, type PageStyle } from './pageStyle';

const attrs = (style: PageStyle) => ({
  'data-cards': style.cards,
  'data-band': hasBand(style) ? (style.band?.full === false ? 'inset' : 'full') : undefined
});

/**
 * Die Seite mit ihrem Entwurf: Farben an der Wurzel (solange sie offen ist), alles andere in dieser Hülle.
 * Ohne Entwurf keine Hülle — eine Seite ohne `style` bleibt, wie sie war.
 */
export function StyledPage({ style, children }: { style: PageStyle | undefined; children: ReactNode }) {
  const key = style === undefined ? '' : JSON.stringify(style);
  useLayoutEffect(() => (style === undefined ? undefined : holdPage(pageHold(style))), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (style === undefined) return <>{children}</>;
  return <div className="pg-styled" {...attrs(style)}>{children}</div>;
}

/** Titel und Vorspann — mit Band, wenn der Entwurf eines hat. */
export function PageHead({ title, lead, style }: { title: string | null; lead: string | null; style: PageStyle | undefined }) {
  if (title === null && lead === null && !hasBand(style)) return null;
  const head = (
    <>
      {title !== null && <h1 className="wk-h1 pg-title">{title}</h1>}
      {lead !== null && <p className="wk-lede wk-page-lead">{lead}</p>}
    </>
  );
  if (!hasBand(style)) return head;
  return (
    <header className="pg-band">
      <div className="pg-band-in">{head}</div>
    </header>
  );
}

/**
 * Die Seite im Kleinen, im Editor: Kopf und drei Bausteine mit genau den Werten des Entwurfs — als eigener Stil an
 * diesem Element, damit der Arbeitsplatz um sie herum bleibt, wie er ist.
 */
export function PageStylePreview({ style, title, lead, dark }: {
  style: PageStyle;
  title: string;
  lead: string;
  dark: boolean;
}) {
  const t = useT();
  const mine = appearance();
  const scheme = style.scheme ?? mine.scheme;
  const vars = scopedVars(style, scheme, mine.hue, mine.tint, dark);

  return (
    <div className="pg-preview" data-scheme={scheme} data-mode={dark ? 'dark' : 'light'} style={vars as CSSProperties}
      aria-label={t('appearance.page.preview')} role="img">
      <div className="pg-styled" {...attrs(style)}>
        <PageHead title={title.trim() === '' ? t('appearance.page.sampleTitle') : title} lead={lead.trim() === '' ? t('appearance.page.sampleLead') : lead} style={style} />
        <div className="pg-preview-grid">
          {[1, 2, 3].map((n) => (
            <article className="wk-card" key={n}>
              <h2 className="wk-card-title">{t('appearance.page.sampleModule', { n })}</h2>
              <p className="wk-card-text">{t('appearance.page.sampleText')}</p>
              {n === 1 && <span className="wk-btn pg-preview-btn">{t('appearance.page.sampleButton')}</span>}
              {n === 2 && <span className="wk-card-muted">{t('appearance.page.sampleMuted')}</span>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
