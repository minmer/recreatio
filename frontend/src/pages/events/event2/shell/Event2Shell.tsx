import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { Event2Page, Event2PageRef, Event2SiteHeader } from '../../../../lib/api';
import { getPartModule } from '../parts/registry';
import { parseLayers, parseTheme, type Layer } from './layers';
import { useSlideScroll } from './useSlideScroll';

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
export function Event2Shell({
  site,
  page,
  accessToken,
  availablePages,
  onSelectPage,
  banner
}: {
  site: Event2SiteHeader;
  page: Event2Page;
  accessToken: string | null;
  /** Empty on the public page; the switcher only appears when there is a choice. */
  availablePages: Event2PageRef[];
  onSelectPage?: (pageSlug: string) => void;
  banner?: ReactNode;
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

  const themeStyle = {
    '--e2-accent': theme.accent,
    '--e2-ink': theme.ink,
    '--e2-ground': theme.ground,
    '--e2-muted': theme.muted
  } as CSSProperties;

  const showSwitcher = availablePages.length > 1 && typeof onSelectPage === 'function';

  return (
    <div className={`e2 ${page.kind === 'internal' ? 'is-internal' : ''}`} style={themeStyle}>
      <header className="e2-header">
        <a className="e2-brand" href="/#/event">
          <img src="/logo_inv.svg" alt="REcreatio" />
        </a>

        {showSwitcher ? (
          <nav className="e2-pages" aria-label="Strony wydarzenia">
            {availablePages.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.slug === page.slug ? 'active' : ''}
                onClick={() => onSelectPage?.(entry.slug)}
              >
                {entry.kind === 'internal' ? (
                  <span className="e2-page-mark" aria-hidden="true">
                    ●
                  </span>
                ) : null}
                {entry.menuLabel}
              </button>
            ))}
          </nav>
        ) : null}

        <nav className="e2-parts" aria-label="Sekcje strony">
          {parts.map((part, index) => (
            <button
              key={part.id}
              type="button"
              className={scroll.activeIndex === index ? 'active' : ''}
              onClick={() => scroll.scrollToSlide(index)}
            >
              {part.menuLabel}
            </button>
          ))}
        </nav>

        <div className="e2-header-meta">
          <span className="e2-header-title">{site.title}</span>
          {page.kind === 'internal' ? <span className="e2-header-tag">{page.menuLabel}</span> : null}
        </div>
      </header>

      <div className="e2-viewport" ref={scroll.viewportRef}>
        <div className="e2-track" style={{ transform: `translate3d(0, ${-scroll.position}px, 0)` }}>
          {parts.map((part, index) => {
            const slide = scroll.geometry[index];
            if (!slide) return null;

            const layers = parseLayers(part.layersJson);
            const module = getPartModule(part.kind);

            return (
              <section
                key={part.id}
                className={`e2-slide ${scroll.activeIndex === index ? 'is-active' : ''}`}
                style={{ height: `${slide.height}px` }}
                aria-label={part.menuLabel}
              >
                {layers.map((layer, layerIndex) => {
                  const height = scroll.viewportHeight + slide.travel * layer.speed;
                  const offset = (1 - layer.speed) * slide.progress * slide.travel;

                  const style: CSSProperties = {
                    height: `${height}px`,
                    transform: `translate3d(0, ${offset}px, 0)`
                  };

                  const background = layerBackground(layer);
                  if (background) style.background = background;

                  if (layer.kind === 'image') {
                    style.backgroundImage = `url(${JSON.stringify(layer.url)})`;
                    style.backgroundSize = 'cover';
                    style.backgroundPosition = layer.position;
                    style.opacity = layer.opacity;
                    style.mixBlendMode = layer.blend;
                  }

                  return (
                    <div
                      key={layerIndex}
                      className={`e2-layer e2-layer--${layer.kind}`}
                      style={style}
                      aria-hidden="true"
                    >
                      {layer.kind === 'bigtext' ? (
                        <div className="e2-bigtext" style={{ opacity: layer.opacity }}>
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
                <div className="e2-content-layer" style={{ height: `${slide.height}px` }}>
                  <div
                    className="e2-content"
                    ref={(element) => {
                      scroll.contentRefs.current[index] = element;
                    }}
                  >
                    {index === 0 && banner ? <div className="e2-banner">{banner}</div> : null}

                    {part.title || part.intro ? (
                      <header className="e2-part-head">
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
                      <p className="e2-note">Nieznany typ sekcji: {part.kind}.</p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <footer className="e2-footer">
        <span>{site.dateLabel ? `${site.title} · ${site.dateLabel}` : site.title}</span>
        <div className="e2-footer-actions">
          <span className="e2-progress" aria-hidden="true">
            {parts.length > 0 ? `${scroll.activeIndex + 1} / ${parts.length}` : '—'}
          </span>
          <a className="e2-ghost" href="/#/event">
            Wydarzenia
          </a>
        </div>
      </footer>
    </div>
  );
}
