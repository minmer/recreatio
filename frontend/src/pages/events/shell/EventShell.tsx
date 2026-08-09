import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { EventPage, EventPageRef, EventSiteHeader } from '../../../lib/api';
import { getPartModule } from '../parts/registry';
import { parseLayers, parseTheme, type Layer } from './layers';
import { useSlideScroll } from './useSlideScroll';

/** Stable in-page anchor for a part, derived from its menu label. */
export function partAnchor(menuLabel: string): string {
  return menuLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function layerBackground(layer: Layer): string | undefined {
  if (layer.kind !== 'gradient') return undefined;
  const stops = layer.via ? `${layer.from}, ${layer.via}, ${layer.to}` : `${layer.from}, ${layer.to}`;
  return `linear-gradient(${layer.angle}deg, ${stops})`;
}

/**
 * The chrome around a page: header with the part menu and — when the reader
 * holds an individual link — a switcher across the pages that link opens.
 * Knows nothing about any individual part.
 */
export function EventShell({
  site,
  page,
  accessToken,
  availablePages,
  onSelectPage,
  banner,
  adminEditHref,
  initialPartIndex,
  partHref,
  pageHref
}: {
  site: EventSiteHeader;
  page: EventPage;
  accessToken: string | null;
  /** Empty on the public page; the switcher only appears when there is a choice. */
  availablePages: EventPageRef[];
  onSelectPage?: (pageSlug: string) => void;
  banner?: ReactNode;
  /** Set only for the event admin — jumps into the editor for this site. */
  adminEditHref?: string | null;
  /** Zero-based part to open on, from /event/{slug}/{n}. */
  initialPartIndex?: number | null;
  /**
   * Address of a part on this page. Given one, the menu and the in-page links
   * become real links — so ctrl-click opens a new tab — and the address bar
   * follows the part being read.
   */
  partHref?: (index: number) => string;
  /** Address of another page of this event, for the same reason. */
  pageHref?: (pageSlug: string) => string;
}) {
  const parts = [...page.parts].sort((a, b) => a.sortOrder - b.sortOrder);
  const scroll = useSlideScroll(parts.length);
  const theme = parseTheme(site.themeJson);
  const { scrollToTop } = scroll;

  // Switching pages must start the new page at the top, not wherever the
  // previous one happened to be scrolled to.
  useEffect(() => {
    scrollToTop();
  }, [page.id, scrollToTop]);

  /**
   * /event/{slug}/{n} opens on part n. The number is the part's position, so
   * nothing extra has to be stored for a part to be linkable — but it also
   * means a link points at a position rather than at a specific part, and
   * reordering the page moves where an old link lands.
   *
   * Waits for measurement: before the parts have been measured every slide
   * starts at the same place and the jump would land on the first one.
   */
  const jumpedRef = useRef(false);
  const { scrollToSlide, geometry } = scroll;
  const measured = geometry.length > 0 && geometry[geometry.length - 1].height > 1;

  useEffect(() => {
    if (jumpedRef.current || !measured) return;
    jumpedRef.current = true;

    if (initialPartIndex === null || initialPartIndex === undefined) return;
    if (initialPartIndex <= 0 || initialPartIndex >= parts.length) return;
    scrollToSlide(initialPartIndex);
  }, [initialPartIndex, measured, parts.length, scrollToSlide]);

  // Keep the address on the part being read, so copying it shares the spot.
  // replaceState rather than a router navigation: this must not add history
  // entries, and the router has nothing to re-render for it.
  useEffect(() => {
    if (!partHref || parts.length === 0) return;
    const target = partHref(scroll.activeIndex);
    if (window.location.hash !== target.replace(/^\//, '')) {
      window.history.replaceState(window.history.state, '', target);
    }
  }, [partHref, parts.length, scroll.activeIndex]);

  const themeStyle = {
    '--ev-accent': theme.accent,
    '--ev-ink': theme.ink,
    '--ev-ground': theme.ground,
    '--ev-muted': theme.muted
  } as CSSProperties;

  const showSwitcher = availablePages.length > 1 && typeof onSelectPage === 'function';

  // The track is moved by transform, so the browser's own anchor jump does
  // nothing. Intercept in-page links and drive the scroller instead.
  const anchorIndex = new Map(parts.map((part, index) => [partAnchor(part.menuLabel), index]));

  /**
   * A modified click is the reader asking the browser for a new tab or window.
   * Those must be left alone, which is the whole reason the menu and the
   * in-page links carry real addresses.
   */
  const isPlainClick = (event: React.MouseEvent) =>
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  /**
   * Parts write plain "#zapisy" links, which under a hash router would send the
   * browser to /#zapisy and lose the route. Rewrite them once they are in the
   * DOM to the part's real address, and remember the target so the click
   * handler still knows where it points. Doing it here rather than in each part
   * keeps every part — and any link typed into free text — working the same.
   */
  const { viewportRef } = scroll;
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || !partHref) return;

    root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
      const index = anchorIndex.get(anchor.getAttribute('href')!.slice(1).toLowerCase());
      if (index === undefined) return;
      anchor.dataset.evPart = String(index);
      anchor.setAttribute('href', partHref(index));
    });
    // anchorIndex is rebuilt on every render; the parts themselves are what
    // actually changes the links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, parts.length, partHref, viewportRef]);

  const onTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlainClick(event)) return;

    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;

    const marked = anchor.dataset.evPart;
    const href = anchor.getAttribute('href') ?? '';
    const index = marked !== undefined ? Number(marked) : anchorIndex.get(href.replace(/^#/, '').toLowerCase());
    if (index === undefined || Number.isNaN(index)) return;

    event.preventDefault();
    scroll.scrollToSlide(index);
  };

  return (
    <div
      className={`ev ${theme.mode === 'light' ? 'is-light' : 'is-dark'} ${
        page.kind === 'internal' ? 'is-internal' : ''
      }`}
      style={themeStyle}
    >
      <header className="ev-header">
        <a className="ev-brand" href="/#/event">
          {/* The white mark would vanish on a light header. */}
          <img src={theme.mode === 'light' ? '/logo_new.svg' : '/logo_inv.svg'} alt="REcreatio" />
        </a>

        {showSwitcher ? (
          <nav className="ev-pages" aria-label="Strony wydarzenia">
            {availablePages.map((entry) => {
              const label = (
                <>
                  {entry.kind === 'internal' ? (
                    <span className="ev-page-mark" aria-hidden="true">
                      ●
                    </span>
                  ) : null}
                  {entry.menuLabel}
                </>
              );
              const className = entry.slug === page.slug ? 'active' : '';

              return pageHref ? (
                <a
                  key={entry.id}
                  className={className}
                  href={pageHref(entry.slug)}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onSelectPage?.(entry.slug);
                  }}
                >
                  {label}
                </a>
              ) : (
                <button key={entry.id} type="button" className={className} onClick={() => onSelectPage?.(entry.slug)}>
                  {label}
                </button>
              );
            })}
          </nav>
        ) : null}

        <nav className="ev-parts" aria-label="Sekcje strony">
          {parts.map((part, index) => {
            const className = scroll.activeIndex === index ? 'active' : '';

            return partHref ? (
              <a
                key={part.id}
                className={className}
                href={partHref(index)}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  scroll.scrollToSlide(index);
                }}
              >
                {part.menuLabel}
              </a>
            ) : (
              <button key={part.id} type="button" className={className} onClick={() => scroll.scrollToSlide(index)}>
                {part.menuLabel}
              </button>
            );
          })}
        </nav>

        <div className="ev-header-meta">
          <span className="ev-header-title">{site.title}</span>
          {page.kind === 'internal' ? <span className="ev-header-tag">{page.menuLabel}</span> : null}
        </div>
      </header>

      <div className="ev-viewport" ref={scroll.viewportRef}>
        <div
          className="ev-track"
          style={{ transform: `translate3d(0, ${-scroll.position}px, 0)` }}
          onClick={onTrackClick}
        >
          {parts.map((part, index) => {
            const slide = scroll.geometry[index];
            if (!slide) return null;

            const layers = parseLayers(part.layersJson, theme.mode);
            const module = getPartModule(part.kind);

            return (
              <section
                key={part.id}
                id={partAnchor(part.menuLabel)}
                className={`ev-slide ${scroll.activeIndex === index ? 'is-active' : ''}`}
                style={{ height: `${slide.height}px` }}
                aria-label={part.menuLabel}
              >
                {layers.map((layer, layerIndex) => {
                  // Big text is not a parallax plane — it is a single line that
                  // sweeps the viewport, so its layer is pinned (speed 0) and
                  // the text moves inside it instead.
                  const isBigText = layer.kind === 'bigtext';
                  const speed = isBigText ? 0 : layer.speed;

                  // Slide-local scroll, deliberately NOT clamped to the slide's
                  // own travel. Clamping froze the parallax during the handover
                  // between slides, so a layer crept at its own rate inside a
                  // slide and then lurched at full track speed across the gap.
                  // Measured over the slide's whole time on screen instead, the
                  // motion is one continuous sweep with nothing to catch on.
                  const local = scroll.position - slide.start;
                  const span = slide.height + scroll.viewportHeight;

                  // Screen-space top works out to -speed × (local + viewport),
                  // and the height covers exactly the rest, so the layer fills
                  // the viewport at every point of the pass and can never gap.
                  const height = scroll.viewportHeight + speed * span;
                  const offset = local * (1 - speed) - speed * scroll.viewportHeight;

                  const style: CSSProperties = {
                    height: `${height}px`,
                    transform: `translate3d(0, ${offset}px, 0)`
                  };

                  const background = layerBackground(layer);
                  if (background) style.background = background;

                  // An image layer with no address yet simply paints nothing,
                  // rather than emitting url("") for the browser to chase.
                  if (layer.kind === 'image' && layer.url.length > 0) {
                    style.backgroundImage = `url(${JSON.stringify(layer.url)})`;
                    style.backgroundSize = 'cover';
                    style.backgroundPosition = layer.position;
                    style.opacity = layer.opacity;
                    style.mixBlendMode = layer.blend;
                  }

                  return (
                    <div
                      key={layerIndex}
                      className={`ev-layer ev-layer--${layer.kind}`}
                      style={style}
                      aria-hidden="true"
                    >
                      {layer.kind === 'bigtext' ? (
                        <div
                          className="ev-bigtext"
                          style={{
                            opacity: layer.opacity,
                            // Driven by visibleProgress, not progress: the sweep
                            // runs for the whole time the slide is on screen —
                            // arriving from the previous slide and leaving
                            // towards the next — instead of being crammed into
                            // the slide's own inner scroll, which on a minimal
                            // slide is only a few percent of a viewport.
                            // speed is the sweep length: 1 = a whole viewport.
                            transform: `translate3d(0, ${
                              (0.5 - slide.visibleProgress) * scroll.viewportHeight * layer.speed
                            }px, 0)`
                          }}
                        >
                          {layer.lines.map((line, lineIndex) => (
                            <span key={lineIndex} style={layer.color ? { color: layer.color } : undefined}>
                              {line}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {/* Content rides at speed 1: no offset, height equal to the slide. */}
                <div className="ev-content-layer" style={{ height: `${slide.height}px` }}>
                  <div
                    className="ev-content"
                    ref={(element) => {
                      scroll.contentRefs.current[index] = element;
                    }}
                  >
                    {index === 0 && banner ? <div className="ev-banner">{banner}</div> : null}

                    {part.title || part.intro ? (
                      <header className="ev-part-head">
                        {part.title ? <h2>{part.title}</h2> : null}
                        {part.intro ? <p>{part.intro}</p> : null}
                      </header>
                    ) : null}

                    {module ? (
                      <module.Renderer
                        configJson={part.configJson}
                        ctx={{ siteSlug: site.slug, accessToken, part }}
                      />
                    ) : (
                      <p className="ev-note">Nieznany typ sekcji: {part.kind}.</p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <footer className="ev-footer">
        <span>{site.dateLabel ? `${site.title} · ${site.dateLabel}` : site.title}</span>
        <div className="ev-footer-actions">
          <span className="ev-progress" aria-hidden="true">
            {parts.length > 0 ? `${scroll.activeIndex + 1} / ${parts.length}` : '—'}
          </span>
          {adminEditHref ? (
            <a className="ev-cta ev-edit" href={adminEditHref}>
              Edytuj
            </a>
          ) : null}
          <a className="ev-ghost" href="/#/event">
            Wydarzenia
          </a>
        </div>
      </footer>
    </div>
  );
}
