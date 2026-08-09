import { useEffect, useState } from 'react';
import { ApiError, getEvent2PublicSite, type Event2PublicSite } from '../../../../lib/api';
import { Event2Shell } from '../shell/Event2Shell';
import { event2EditHref, useIsEvent2Admin } from '../shell/useIsEvent2Admin';

/** The address anyone can open. Internal pages are never referenced from here. */
export function Event2PublicView({ slug }: { slug: string }) {
  const isAdmin = useIsEvent2Admin();
  const [data, setData] = useState<Event2PublicSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getEvent2PublicSite(slug)
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
      <div className="e2-standalone">
        <p>Ładowanie…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="e2-standalone">
        <h1>Wydarzenie niedostępne</h1>
        <p>{error ?? 'Nie udało się pobrać wydarzenia.'}</p>
        <a className="e2-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  if (data.page.parts.length === 0) {
    return (
      <div className="e2-standalone">
        <h1>{data.site.title}</h1>
        <p>Ta strona nie ma jeszcze żadnych sekcji.</p>
        <a className="e2-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  return (
    <Event2Shell
      site={data.site}
      page={data.page}
      accessToken={null}
      availablePages={[]}
      adminEditHref={isAdmin ? event2EditHref(data.site.id) : null}
    />
  );
}
