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
import { WorkspaceError } from './session';

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
  const [failed, setFailed] = useState<string | null>(null);
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
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.classList.remove('wk-widget-mode');
  }, [opts]);

  useEffect(() => {
    let alive = true;
    if (partId === null || pagePath === '') {
      setPart(null);
      setFailed('W adresie widżetu brakuje modułu albo strony.');
      return;
    }
    loadPage(pagePath)
      .then((page) => {
        if (!alive) return;
        const found = page.parts.map(toDraft).find((p) => p.id === partId || p.moduleId === partId) ?? null;
        setPart(found);
        if (found === null) setFailed('Tego modułu nie ma na tej stronie.');
      })
      .catch((e) => {
        if (!alive) return;
        setPart(null);
        const verdict = e instanceof WorkspaceError ? e.verdict : null;
        setFailed(verdict === 'needsaccess' || verdict === 'noaccess'
          ? 'Ta strona nie jest publiczna — widżet pokazuje tylko to, co widzi każdy.'
          : 'Nie udało się wczytać.');
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

  return (
    <div className="wk-widget" ref={box}>
      {part === undefined ? <p className="wk-hint">Wczytywanie…</p>
        : part === null || def === undefined ? <p className="wk-hint">{failed ?? 'Tego modułu nie da się pokazać.'}</p>
        : (
          <article className={`wk-card wk-card-${part.kind} wk-widget-card`} data-w={size.width} data-h={size.height} onClick={onClick}>
            <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size }} />
          </article>
        )}
      <a className="wk-widget-foot" href={target} target="_blank" rel="noopener" onClick={(e) => { e.preventDefault(); go(); }}>
        recreatio.pl<span aria-hidden="true"> ↗</span>
      </a>
    </div>
  );
}

export default Widget;
