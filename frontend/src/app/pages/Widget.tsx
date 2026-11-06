/**
 * WIDŻET (0067) — ein Baustein einer öffentlichen Seite, auf einer FREMDEN
 * Seite: `#/widget/<baustein>/<pfad der seite>?w=wide&h=block`.
 *
 * <b>Nur Öffentliches.</b> Die Seite wird geholt wie von jedem Besucher —
 * ohne Konto, ohne Link. Eine Seite nur mit Zugang zeigt hier nichts.
 *
 * <b>Ein Klick führt nach recreatio.pl</b>: auf die Seite, an die Stelle des
 * Bausteins (`#part-<id>`), in einem neuen Fenster (`?open=top`: im selben).
 * Knöpfe, die IM Baustein etwas umschalten (der nächste Monat im Kalender),
 * bleiben Knöpfe.
 *
 * <b>Die Höhe sagt der Widżet selbst</b> (postMessage) — `public/widget.js`
 * auf der fremden Seite passt das iframe an.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { loadPage, toDraft, type DraftPart } from './page';
import { partSize, type PartSize } from './part';
import { partOf } from './parts/registry';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import { BLOCKED_KIND, BLOCKED_PART_TEXT, reportPath } from '../reports/reportPath';
import { useT, type Lang } from '../core/i18n';
import { InLang } from './pageLang';
import { langOfLayout } from './layout';
import { readLook } from './slides/slideLook';
import { holdPage } from '../core/theme';

const WIDTHS: Record<string, number> = { narrow: 2, medium: 3, wide: 4, full: 6 };
const HEIGHTS: Record<string, number> = { strip: 1, block: 3, tall: 5 };

/** Die Einstellungen hinter `?` in der Raute — der Weg dorthin zählt nicht zum Pfad. */
function options(): URLSearchParams {
  const hash = window.location.hash;
  const at = hash.indexOf('?');
  return new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
}

/** Wo die Seite auf recreatio.pl steht — hier, wo das Widget herkommt. */
export const pageUrlOf = (path: string, partId?: string): string =>
  `${window.location.origin}${window.location.pathname}#/${path.split('/').map(encodeURIComponent).join('/')}`
  + (partId === undefined ? '' : `?part=${encodeURIComponent(partId)}`);

/** Der Code zum Einfügen — für den Editor (`WidgetEmbed`). */
export function embedCode(path: string, partId: string, title: string, size: { w: string; h: string }): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const src = `${base}#/widget/${encodeURIComponent(partId)}/${path.split('/').map(encodeURIComponent).join('/')}?w=${size.w}&h=${size.h}`;
  const script = `${base.replace(/\/[^/]*$/, '/')}widget.js`;
  const safeTitle = title.replace(/"/g, '&quot;');
  return `<iframe data-recreatio src="${src}" style="width:100%;border:0;height:360px" loading="lazy" title="${safeTitle}"></iframe>\n<script src="${script}" async></script>`;
}

export function Widget({ partId, pagePath }: { partId: string | null; pagePath: string }) {
  const [part, setPart] = useState<DraftPart | null | undefined>(undefined);
  const t = useT();
  const [failed, setFailed] = useState<string | null>(null);
  /* 0130 — die ganze Seite ist nach einer Meldung gesperrt. */
  const [blockedPage, setBlockedPage] = useState(false);
  /* 2026-11-05 — die Sprache der Seite (`look.lang`), wie auf ihr selbst. */
  const [pageLang, setPageLang] = useState<Lang | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const opts = useMemo(options, []);

  const size: PartSize = partSize({
    colSpan: WIDTHS[opts.get('w') ?? ''] ?? 4,
    rowSpan: HEIGHTS[opts.get('h') ?? ''] ?? 3
  });

  /* Durchsichtig auf der fremden Seite, ohne Rand und ohne Rollbalken. */
  useEffect(() => {
    document.documentElement.classList.add('wk-widget-mode');
    const theme = opts.get('theme');
    /* 2026-11-06 — hell oder dunkel wie verlangt (core/theme.ts); `data-theme` bleibt für ältere Regeln. */
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    const release = theme === 'light' || theme === 'dark' ? holdPage({ mode: theme }) : null;
    return () => { release?.(); document.documentElement.classList.remove('wk-widget-mode'); };
  }, [opts]);

  useEffect(() => {
    let alive = true;
    if (partId === null || pagePath === '') {
      setPart(null);
      setFailed(t('pages.widget.missing'));
      return;
    }
    loadPage(pagePath)
      .then((page) => {
        if (!alive) return;
        setPageLang(readLook(page.theme).lang ?? null);
        const found = page.parts.map(toDraft).find((p) => p.id === partId || p.moduleId === partId) ?? null;
        setPart(found);
        if (found === null) setFailed(t('pages.widget.notHere'));
      })
      .catch((e) => {
        if (!alive) return;
        setPart(null);
        const verdict = e instanceof WorkspaceError ? e.verdict : null;
        setBlockedPage(verdict === 'blocked');
        setFailed(verdict === 'needsaccess' || verdict === 'noaccess'
          ? t('pages.widget.notPublic')
          : verdict === 'blocked' ? t('pages.public.blockedText')
          : t('pages.widget.loadFailed'));
      });
    return () => { alive = false; };
  }, [partId, pagePath]);

  /* DIE HÖHE an die fremde Seite — bei jeder Änderung des Inhalts. */
  useEffect(() => {
    const el = box.current;
    if (el === null || window.parent === window) return;
    const tell = () => window.parent.postMessage({ type: 'recreatio:widget', height: el.scrollHeight }, '*');
    tell();
    const watch = new ResizeObserver(tell);
    watch.observe(el);
    return () => watch.disconnect();
  }, [part]);

  const target = pageUrlOf(pagePath, partId ?? undefined);
  const go = () => {
    if (opts.get('open') === 'top') {
      try { window.top!.location.href = target; return; } catch { /* fremde Seite verbietet es — dann neu */ }
    }
    window.open(target, '_blank', 'noopener');
  };

  /*
   * EIN KLICK AUF INHALT führt nach recreatio.pl; ein Knopf oder ein Feld
   * bleibt, was es ist. Verweise innerhalb der Seite gehen ebenfalls hinüber
   * — hier im Rahmen führten sie ins Leere.
   */
  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    const el = event.target as HTMLElement;
    const link = el.closest('a');
    if (link !== null) {
      const href = link.getAttribute('href') ?? '';
      event.preventDefault();
      if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
      else go();
      return;
    }
    if (el.closest('button, input, select, textarea, summary, label, [role="button"]') !== null) return;
    go();
  };

  const def = part == null ? undefined : partOf(part.kind);

  /* 0130 — „Zgłoś" führt auf recreatio.pl (woher das Widget kommt), auf die Meldung DIESES Teils. */
  const reportHref = part == null ? null : `${window.location.origin}${window.location.pathname}${reportPath('part', part.id)}`;

  const quiet = (className: string, said: string | null) => <p className={className}>{said}</p>;
  const body = part === undefined ? <Loading label={t('common.loading')} />
    : part !== null && part.kind === BLOCKED_KIND ? quiet('wk-blocked', BLOCKED_PART_TEXT)
    : blockedPage ? quiet('wk-blocked', failed)
    : part === null || def === undefined ? quiet('wk-hint', failed ?? t('pages.widget.cannotShow'))
    : (
      <InLang lang={langOfLayout(part.layout)}>
        <article className={`wk-card wk-card-${part.kind} wk-widget-card`} data-w={size.width} data-h={size.height} onClick={onClick}>
          <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size }} />
        </article>
      </InLang>
    );

  return (
    <InLang lang={pageLang}>
    <div className="wk-widget" ref={box}>
      {body}
      <div className="wk-widget-bottom">
        {reportHref !== null && part?.kind !== BLOCKED_KIND && (
          <a className="wk-widget-report" href={reportHref} target="_blank" rel="noopener" data-report="part">{t('pages.widget.report')}</a>
        )}
        <a className="wk-widget-foot" href={target} target="_blank" rel="noopener" onClick={(e) => { e.preventDefault(); go(); }}>
          {'recreatio.pl'}<span aria-hidden="true"> ↗</span>
        </a>
      </div>
    </div>
    </InLang>
  );
}

export default Widget;
