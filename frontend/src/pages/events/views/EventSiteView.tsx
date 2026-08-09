import { useEffect, useState } from 'react';
import { ApiError, getEventPublicSite, type EventPublicSite } from '../../../lib/api';
import { EventShell } from '../shell/EventShell';
import { eventEditHref, useIsEventAdmin } from '../shell/useIsEventAdmin';

/** The address anyone can open. Internal pages are never referenced from here. */
export function EventSiteView({ slug, initialPart }: { slug: string; initialPart: string | null }) {
  const isAdmin = useIsEventAdmin();
  const [data, setData] = useState<EventPublicSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getEventPublicSite(slug)
      .then((response) => {
        if (!active) return;
        setData(response);
        document.title = `${response.site.title} | REcreatio`;
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        if (fetchError instanceof ApiError && fetchError.status === 404) {
          setError('Nie znaleziono tego wydarzenia albo nie zostało jeszcze opublikowane.');
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Nie udało się pobrać wydarzenia.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

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
        <h1>Wydarzenie niedostępne</h1>
        <p>{error ?? 'Nie udało się pobrać wydarzenia.'}</p>
        <a className="ev-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  if (data.page.parts.length === 0) {
    return (
      <div className="ev-standalone">
        <h1>{data.site.title}</h1>
        <p>Ta strona nie ma jeszcze żadnych sekcji.</p>
        <a className="ev-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  return (
    <EventShell
      site={data.site}
      page={data.page}
      accessToken={null}
      availablePages={[]}
      adminEditHref={isAdmin ? eventEditHref(data.site.id) : null}
      initialPartIndex={initialPart ? Number.parseInt(initialPart, 10) - 1 : null}
    />
  );
}
