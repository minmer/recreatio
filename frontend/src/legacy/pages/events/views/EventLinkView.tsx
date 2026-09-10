import { useCallback, useEffect, useState } from 'react';
import { ApiError, getEventLink, type EventLinkView as LinkView } from '../../../lib/api';
import { EventShell } from '../shell/EventShell';
import { eventEditHref, useIsEventAdmin } from '../shell/useIsEventAdmin';

/**
 * The individual link. The token decides which pages come back, so an internal
 * page is never present in the payload for a link that was not granted it.
 */
export function EventLinkView({
  token,
  initialPage,
  initialPart
}: {
  token: string;
  /** Page slug from /event/link/{token}/{page}, so a page can be linked to. */
  initialPage: string | null;
  /** 1-based part number from /event/link/{token}/{page}/{n}. */
  initialPart: string | null;
}) {
  const [data, setData] = useState<LinkView | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useIsEventAdmin();

  const load = useCallback(
    async (pageSlug: string | null, isSwitch: boolean) => {
      if (isSwitch) setSwitching(true);
      else setLoading(true);

      try {
        const response = await getEventLink(token, pageSlug);
        setData(response);
        setError(null);
        document.title = `${response.site.title} · ${response.page.menuLabel}`;
      } catch (fetchError: unknown) {
        if (fetchError instanceof ApiError && fetchError.status === 404) {
          setError('Ten link jest nieaktywny albo nie istnieje.');
        } else {
          setError(fetchError instanceof Error ? fetchError.message : 'Nie udało się otworzyć linku.');
        }
      } finally {
        setLoading(false);
        setSwitching(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void load(initialPage, false);
    // Only the first load follows the address; after that the switcher decides
    // which page is open and rewrites the address itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Both addresses are stable across renders: the shell keys effects off them.
  const openPage = data?.page.slug ?? '';
  const pageHref = useCallback((pageSlug: string) => `/#/event/link/${token}/${pageSlug}`, [token]);
  const partHref = useCallback(
    (index: number) => {
      const base = `/#/event/link/${token}/${openPage}`;
      return index === 0 ? base : `${base}/${index + 1}`;
    },
    [openPage, token]
  );

  if (loading) {
    return (
      <div className="ev-standalone">
        <p>Ładowanie…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ev-standalone">
        <h1>Link niedostępny</h1>
        <p>{error ?? 'Nie udało się otworzyć linku.'}</p>
        <a className="ev-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  const internalCount = data.availablePages.filter((entry) => entry.kind === 'internal').length;

  const banner = (
    <section className="ev-link-card">
      <div className="ev-link-head">
        <div>
          <p className="ev-link-eyebrow">Link osobisty</p>
          <h2>{data.recipientName}</h2>
        </div>
        <span className="ev-chip">
          {internalCount === 0
            ? 'Brak stron wewnętrznych'
            : `${internalCount} ${internalCount === 1 ? 'strona wewnętrzna' : 'stron wewnętrznych'}`}
        </span>
      </div>

      {data.personalNote ? <p className="ev-link-note">{data.personalNote}</p> : null}

      {data.assignments.length > 0 ? (
        <dl className="ev-link-assignments">
          {data.assignments.map((assignment, index) => (
            <div key={index}>
              <dt>{assignment.label}</dt>
              <dd>{assignment.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {internalCount === 0 ? (
        <p className="ev-note">
          Ten link nie ma jeszcze przypisanej żadnej strony wewnętrznej. Widzisz stronę publiczną wydarzenia.
        </p>
      ) : null}
    </section>
  );

  return (
    <div className={switching ? 'ev-switching' : undefined}>
      <EventShell
        site={data.site}
        page={data.page}
        accessToken={token}
        availablePages={data.availablePages}
        onSelectPage={(pageSlug) => void load(pageSlug, true)}
        banner={banner}
        adminEditHref={isAdmin ? eventEditHref(data.site.id) : null}
        initialPartIndex={initialPart ? Number.parseInt(initialPart, 10) - 1 : null}
        partHref={partHref}
        pageHref={pageHref}
      />
    </div>
  );
}
