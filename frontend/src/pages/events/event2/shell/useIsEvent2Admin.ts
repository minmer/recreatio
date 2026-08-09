import { useEffect, useState } from 'react';
import { getEvent2AdminStatus } from '../../../../lib/api';

/**
 * Whether the current visitor owns the event2 admin scope. Used only to decide
 * whether to offer an edit shortcut — every endpoint behind it re-checks server
 * side, so a wrong answer here reveals nothing.
 */
export function useIsEvent2Admin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    getEvent2AdminStatus()
      .then((status) => {
        if (active) setIsAdmin(status.isCurrentUserAdmin);
      })
      .catch(() => {
        // Not signed in, or the check failed — either way, no edit button.
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return isAdmin;
}

/** Deep link into the builder, opened straight on this site. */
export function event2EditHref(siteId: string): string {
  return `/#/event/event2/admin/${siteId}`;
}
