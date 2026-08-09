import { Event2AdminPage } from './admin/Event2AdminPage';
import { Event2LinkView } from './views/Event2LinkView';
import { Event2PublicView } from './views/Event2PublicView';
import '../../../styles/event2.css';

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
export function Event2Router({
  mode,
  argument
}: {
  mode: 'site' | 'admin' | 'link';
  argument: string | null;
}) {
  if (mode === 'link') {
    if (!argument) return <MissingArgument message="Ten link jest niekompletny." />;
    return <Event2LinkView token={argument} />;
  }

  if (mode === 'admin') {
    return <Event2AdminPage initialSiteId={argument} />;
  }

  if (!argument) return <MissingArgument message="Nie podano adresu wydarzenia." />;
  return <Event2PublicView slug={argument} />;
}

function MissingArgument({ message }: { message: string }) {
  return (
    <div className="e2-standalone">
      <h1>Nie znaleziono strony</h1>
      <p>{message}</p>
      <a className="e2-ghost" href="/#/event">
        Wróć do listy wydarzeń
      </a>
    </div>
  );
}
