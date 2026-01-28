import { useEffect, useMemo, useState } from 'react';
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
    groups: {
      libraryOverview: string;
      libraryGraph: string;
      cardsBrowse: string;
      cardsAdd: string;
      collectionsManage: string;
      currentOverview: string;
      currentRevision: string;
    };
    items: {
      overview: string;
      dependencies: string;
      list: string;
      add: string;
      createCollection: string;
      collections: string;
      collectionDetail: string;
      collectionGraph: string;
      revisionSettings: string;
      revisionRun: string;
    };
  };
};

type SidebarItem = { label: string; href: string };
type SidebarGroup = { key: string; title: string; items: SidebarItem[] };
type SidebarSection = { key: string; title: string; groups: SidebarGroup[] };

const buildSections = (libraryId: string, collectionId: string | undefined, labels: CogitaLibrarySidebarProps['labels']) => {
  const base = `/#/cogita/library/${libraryId}`;
  const sections: SidebarSection[] = [
    {
      key: 'library',
      title: labels.sections.library,
      groups: [
        {
          key: 'libraryOverview',
          title: labels.groups.libraryOverview,
          items: [{ label: labels.items.overview, href: base }]
        },
        {
          key: 'libraryGraph',
          title: labels.groups.libraryGraph,
          items: [{ label: labels.items.dependencies, href: `${base}/dependencies` }]
        }
      ]
    },
    {
      key: 'cards',
      title: labels.sections.cards,
      groups: [
        {
          key: 'cardsBrowse',
          title: labels.groups.cardsBrowse,
          items: [{ label: labels.items.list, href: `${base}/list` }]
        },
        {
          key: 'cardsAdd',
          title: labels.groups.cardsAdd,
          items: [{ label: labels.items.add, href: `${base}/new` }]
        }
      ]
    },
    {
      key: 'collections',
      title: labels.sections.collections,
      groups: [
        {
          key: 'collectionsManage',
          title: labels.groups.collectionsManage,
          items: [
            { label: labels.items.collections, href: `${base}/collections` },
            { label: labels.items.createCollection, href: `${base}/collections/new` }
          ]
        }
      ]
    }
  ];

  if (collectionId) {
    sections.push({
      key: 'currentCollection',
      title: labels.sections.currentCollection,
      groups: [
        {
          key: 'currentOverview',
          title: labels.groups.currentOverview,
          items: [
            { label: labels.items.collectionDetail, href: `${base}/collections/${collectionId}` },
            { label: labels.items.collectionGraph, href: `${base}/collections/${collectionId}/graph` }
          ]
        },
        {
          key: 'currentRevision',
          title: labels.groups.currentRevision,
          items: [
            { label: labels.items.revisionSettings, href: `${base}/collections/${collectionId}/revision` },
            { label: labels.items.revisionRun, href: `${base}/collections/${collectionId}/revision/run` }
          ]
        }
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

  const initialExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {};
    sections.forEach((section) => {
      expanded[section.key] = section.groups.some((group) => group.items.some((item) => isActive(item.href)));
    });
    return expanded;
  }, [sections, active, basePath]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(initialExpanded);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      sections.forEach((section) => {
        if (section.groups.some((group) => group.items.some((item) => isActive(item.href)))) {
          next[section.key] = true;
        }
      });
      return next;
    });
  }, [sections, active, basePath]);

  return (
    <aside className="cogita-library-sidebar" aria-label={labels.title}>
      <p className="cogita-sidebar-title">{labels.title}</p>
      {sections.map((section) => (
        <div className="cogita-sidebar-section" key={section.title}>
          <button
            type="button"
            className="cogita-sidebar-section-title"
            data-expanded={expandedSections[section.key]}
            onClick={() =>
              setExpandedSections((prev) => ({
                ...prev,
                [section.key]: !prev[section.key]
              }))
            }
          >
            {section.title}
          </button>
          {expandedSections[section.key] && (
            <div className="cogita-sidebar-links">
              {section.groups.map((group) => (
                <div key={group.key} className="cogita-sidebar-subsection">
                  <p className="cogita-sidebar-subtitle">{group.title}</p>
                  <div className="cogita-sidebar-sublinks">
                    {group.items.map((item) => (
                      <a key={item.href} href={item.href} data-active={isActive(item.href)}>
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
