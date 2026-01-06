import { useEffect, useState } from 'react';
import type { RouteKey } from '../types/navigation';

export function routeFromPath(pathname: string): RouteKey {
  if (pathname.startsWith('/parish')) return 'parish';
  if (pathname.startsWith('/cogita')) return 'cogita';
  if (pathname.startsWith('/faq')) return 'faq';
  if (pathname.startsWith('/legal')) return 'legal';
  if (pathname.startsWith('/account')) return 'account';
  return 'home';
}

export function pathFromRoute(route: RouteKey): string {
  if (route === 'parish') return '/parish';
  if (route === 'cogita') return '/cogita';
  if (route === 'faq') return '/faq';
  if (route === 'legal') return '/legal';
  if (route === 'account') return '/account';
  return '/';
}

export function useRoute() {
  const [route, setRoute] = useState<RouteKey>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const handler = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = (next: RouteKey) => {
    setRoute(next);
    window.history.pushState({}, '', pathFromRoute(next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { route, navigate, setRoute };
}
