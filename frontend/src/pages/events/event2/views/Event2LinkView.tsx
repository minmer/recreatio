import { useCallback, useEffect, useState } from 'react';
import { ApiError, getEvent2Link, type Event2LinkView as LinkView } from '../../../../lib/api';
import { Event2Shell } from '../shell/Event2Shell';

/**
 * The individual link. The token decides which pages come back, so an internal
 * page is never present in the payload for a link that was not granted it.
 */
export function Event2LinkView({ token }: { token: string }) {
  const [data, setData] = useState<LinkView | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageSlug: string | null, isSwitch: boolean) => {
      if (isSwitch) setSwitching(true);
      else setLoading(true);

      try {
        const response = await getEvent2Link(token, pageSlug);
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
    void load(null, false);
  }, [load]);

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
        <h1>Link niedostępny</h1>
        <p>{error ?? 'Nie udało się otworzyć linku.'}</p>
        <a className="e2-ghost" href="/#/event">
          Wróć do listy wydarzeń
        </a>
      </div>
    );
  }

  const internalCount = data.availablePages.filter((entry) => entry.kind === 'internal').length;

  const banner = (
    <section className="e2-link-card">
      <div className="e2-link-head">
        <div>
          <p className="e2-link-eyebrow">Link osobisty</p>
          <h2>{data.recipientName}</h2>
        </div>
        <span className="e2-chip">
          {internalCount === 0
            ? 'Brak stron wewnętrznych'
            : `${internalCount} ${internalCount === 1 ? 'strona wewnętrzna' : 'stron wewnętrznych'}`}
        </span>
      </div>

      {data.personalNote ? <p className="e2-link-note">{data.personalNote}</p> : null}

      {data.assignments.length > 0 ? (
        <dl className="e2-link-assignments">
          {data.assignments.map((assignment, index) => (
            <div key={index}>
              <dt>{assignment.label}</dt>
              <dd>{assignment.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {internalCount === 0 ? (
        <p className="e2-note">
          Ten link nie ma jeszcze przypisanej żadnej strony wewnętrznej. Widzisz stronę publiczną wydarzenia.
        </p>
      ) : null}
    </section>
  );

  return (
    <div className={switching ? 'e2-switching' : undefined}>
      <Event2Shell
        site={data.site}
        page={data.page}
        accessToken={token}
        availablePages={data.availablePages}
        onSelectPage={(pageSlug) => void load(pageSlug, true)}
        banner={banner}
      />
    </div>
  );
}
