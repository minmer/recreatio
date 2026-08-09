import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from '../../eventTypes';
import { Event2AdminPage } from '../../event2/admin/Event2AdminPage';
import { Event2LinkView } from '../../event2/views/Event2LinkView';
import { Event2PublicView } from '../../event2/views/Event2PublicView';
import '../../../../styles/event2.css';

/**
 * Routing entry for composable events. Three shapes live under /event/event2:
 *   /admin          → the builder
 *   /site/{slug}    → the public page
 *   /link/{token}   → one person's individual link
 */
export function Event2EventPage(
  _props: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }
) {
  const location = useLocation();
  const segments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);

  // ['event', 'event2', <mode>, <argument>]
  const mode = segments[2] ?? 'admin';
  const argument = segments[3] ?? null;

  if (mode === 'link' && argument) return <Event2LinkView token={argument} />;
  if (mode === 'site' && argument) return <Event2PublicView slug={argument} />;
  // /admin/{siteId} opens the builder straight on that event.
  return <Event2AdminPage initialSiteId={argument} />;
}
