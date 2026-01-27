import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

type CogitaLibraryNavProps = {
  libraryId: string;
  labels: {
    overview: string;
    list: string;
    add: string;
    collections: string;
  };
  ariaLabel?: string;
};

const buildItems = (libraryId: string, labels: CogitaLibraryNavProps['labels']) => [
  { label: labels.overview, href: `/#/cogita/library/${libraryId}` },
  { label: labels.list, href: `/#/cogita/library/${libraryId}/list` },
  { label: labels.add, href: `/#/cogita/library/${libraryId}/new` },
  { label: labels.collections, href: `/#/cogita/library/${libraryId}/collections` }
];

export function CogitaLibraryNav({ libraryId, labels, ariaLabel }: CogitaLibraryNavProps) {
  const location = useLocation();
  const items = useMemo(() => buildItems(libraryId, labels), [libraryId, labels]);
  const active = location.pathname || '';
  const basePath = `/cogita/library/${libraryId}`;

  const isActive = (href: string) => {
    const path = href.replace('/#', '');
    if (path === basePath) {
      return active === basePath || active === `${basePath}/`;
    }
    if (path.endsWith('/list')) {
      return (
        active.startsWith(path) ||
        active.startsWith(`${basePath}/detail`) ||
        active.startsWith(`${basePath}/collection`)
      );
    }
    return active.startsWith(path);
  };

  return (
    <nav className="cogita-library-nav" aria-label={ariaLabel ?? 'Library navigation'}>
      {items.map((item) => (
        <a key={item.href} href={item.href} data-active={isActive(item.href)}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
