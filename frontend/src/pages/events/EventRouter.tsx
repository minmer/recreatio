import { EventAdminPage } from './admin/EventAdminPage';
import { EventLinkView } from './views/EventLinkView';
import { EventSiteView } from './views/EventSiteView';
import '../../styles/event-site.css';

/**
 * Everything under /event that is not the overview.
 *
 *   /event/{slug}        → the assembled public page
 *   /event/admin         → the builder
 *   /event/admin/{id}    → the builder, opened on one event
 *   /event/link/{token}  → one person's individual link
 *
 * `admin` and `link` are therefore reserved and cannot be event slugs; the API
 * refuses them at creation so the two can never collide.
 */
export function EventRouter({
  mode,
  argument,
  part
}: {
  mode: 'site' | 'admin' | 'link';
  argument: string | null;
  /** 1-based part number from /event/{slug}/{n}. */
  part?: string | null;
}) {
  if (mode === 'link') {
    if (!argument) return <MissingArgument message="Ten link jest niekompletny." />;
    return <EventLinkView token={argument} />;
  }

  if (mode === 'admin') {
    return <EventAdminPage initialSiteId={argument} />;
  }

  if (!argument) return <MissingArgument message="Nie podano adresu wydarzenia." />;
  return <EventSiteView slug={argument} initialPart={part ?? null} />;
}

function MissingArgument({ message }: { message: string }) {
  return (
    <div className="ev-standalone">
      <h1>Nie znaleziono strony</h1>
      <p>{message}</p>
      <a className="ev-ghost" href="/#/event">
        Wróć do listy wydarzeń
      </a>
    </div>
  );
}
