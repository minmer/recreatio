import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

type CogitaLibrarySidebarProps = {
  libraryId: string;
  collectionId?: string;
  labels: {
    title: string;
    sections: {
      library: string;
      cards: string;
      collections: string;
      currentCollection: string;
    };
    items: {
      overview: string;
      list: string;
      add: string;
      collections: string;
      createCollection: string;
      collectionDetail: string;
      collectionGraph: string;
      revisionSettings: string;
      revisionRun: string;
    };
  };
};

type SidebarItem = { label: string; href: string };
type SidebarSection = { title: string; items: SidebarItem[] };

const buildSections = (libraryId: string, collectionId: string | undefined, labels: CogitaLibrarySidebarProps['labels']) => {
  const base = `/#/cogita/library/${libraryId}`;
  const sections: SidebarSection[] = [
    {
      title: labels.sections.library,
      items: [{ label: labels.items.overview, href: base }]
    },
    {
      title: labels.sections.cards,
      items: [
        { label: labels.items.list, href: `${base}/list` },
        { label: labels.items.add, href: `${base}/new` }
      ]
    },
    {
      title: labels.sections.collections,
      items: [
        { label: labels.items.collections, href: `${base}/collections` },
        { label: labels.items.createCollection, href: `${base}/collections/new` }
      ]
    }
  ];

  if (collectionId) {
    sections.push({
      title: labels.sections.currentCollection,
      items: [
        { label: labels.items.collectionDetail, href: `${base}/collections/${collectionId}` },
        { label: labels.items.collectionGraph, href: `${base}/collections/${collectionId}/graph` },
        { label: labels.items.revisionSettings, href: `${base}/collections/${collectionId}/revision` },
        { label: labels.items.revisionRun, href: `${base}/collections/${collectionId}/revision/run` }
      ]
    });
  }

  return sections;
};

export function CogitaLibrarySidebar({ libraryId, collectionId, labels }: CogitaLibrarySidebarProps) {
  const location = useLocation();
  const sections = useMemo(() => buildSections(libraryId, collectionId, labels), [libraryId, collectionId, labels]);
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
    <aside className="cogita-library-sidebar" aria-label={labels.title}>
      <p className="cogita-sidebar-title">{labels.title}</p>
      {sections.map((section) => (
        <div className="cogita-sidebar-section" key={section.title}>
          <p className="cogita-sidebar-section-title">{section.title}</p>
          <div className="cogita-sidebar-links">
            {section.items.map((item) => (
              <a key={item.href} href={item.href} data-active={isActive(item.href)}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
