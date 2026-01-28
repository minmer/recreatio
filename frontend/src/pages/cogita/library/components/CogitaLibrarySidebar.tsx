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
      libraryStats: string;
      libraryTransfers: string;
      librarySecurity: string;
      cardsBrowse: string;
      cardsAdd: string;
      cardsTypes: string;
      collectionsManage: string;
      collectionsTemplates: string;
      collectionsRevision: string;
      currentOverview: string;
      currentRevision: string;
      currentInsights: string;
      currentExport: string;
    };
    items: {
      overview: string;
      dependencies: string;
      libraryStats: string;
      libraryRoles: string;
      libraryTransfers: string;
      librarySecurity: string;
      list: string;
      add: string;
      typeVocab: string;
      typeLanguage: string;
      typeWord: string;
      typeSentence: string;
      typeTopic: string;
      typePerson: string;
      typeAddress: string;
      typeEmail: string;
      typePhone: string;
      typeBook: string;
      typeMedia: string;
      typeGeo: string;
      typeMusic: string;
      typeComputed: string;
      createCollection: string;
      collections: string;
      smartCollections: string;
      dependencyRules: string;
      revisionQueue: string;
      revisionHistory: string;
      collectionDetail: string;
      collectionGraph: string;
      revisionSettings: string;
      revisionRun: string;
      collectionStats: string;
      collectionKnowness: string;
      collectionExport: string;
    };
    badges: {
      comingSoon: string;
    };
  };
};

type SidebarItem = { label: string; href?: string; disabled?: boolean; badge?: string };
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
          items: [
            { label: labels.items.dependencies, href: `${base}/dependencies` },
            { label: labels.items.libraryRoles, disabled: true, badge: labels.badges.comingSoon }
          ]
        },
        {
          key: 'libraryStats',
          title: labels.groups.libraryStats,
          items: [{ label: labels.items.libraryStats, disabled: true, badge: labels.badges.comingSoon }]
        },
        {
          key: 'libraryTransfers',
          title: labels.groups.libraryTransfers,
          items: [{ label: labels.items.libraryTransfers, href: base }]
        },
        {
          key: 'librarySecurity',
          title: labels.groups.librarySecurity,
          items: [{ label: labels.items.librarySecurity, disabled: true, badge: labels.badges.comingSoon }]
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
        },
        {
          key: 'cardsTypes',
          title: labels.groups.cardsTypes,
          items: [
            { label: labels.items.typeVocab, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeLanguage, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeWord, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeSentence, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeTopic, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typePerson, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeAddress, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeEmail, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typePhone, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeBook, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeMedia, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeGeo, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeMusic, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.typeComputed, disabled: true, badge: labels.badges.comingSoon }
          ]
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
        },
        {
          key: 'collectionsTemplates',
          title: labels.groups.collectionsTemplates,
          items: [
            { label: labels.items.smartCollections, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.dependencyRules, disabled: true, badge: labels.badges.comingSoon }
          ]
        },
        {
          key: 'collectionsRevision',
          title: labels.groups.collectionsRevision,
          items: [
            { label: labels.items.revisionQueue, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.revisionHistory, disabled: true, badge: labels.badges.comingSoon }
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
        },
        {
          key: 'currentInsights',
          title: labels.groups.currentInsights,
          items: [
            { label: labels.items.collectionStats, disabled: true, badge: labels.badges.comingSoon },
            { label: labels.items.collectionKnowness, disabled: true, badge: labels.badges.comingSoon }
          ]
        },
        {
          key: 'currentExport',
          title: labels.groups.currentExport,
          items: [
            { label: labels.items.collectionExport, disabled: true, badge: labels.badges.comingSoon }
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

  const isActive = (href?: string) => {
    if (!href) return false;
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
  const initialGroupExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {};
    sections.forEach((section) => {
      section.groups.forEach((group) => {
        expanded[`${section.key}:${group.key}`] = group.items.some((item) => isActive(item.href));
      });
    });
    return expanded;
  }, [sections, active, basePath]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(initialGroupExpanded);

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
    setExpandedGroups((prev) => {
      const next = { ...prev };
      sections.forEach((section) => {
        section.groups.forEach((group) => {
          if (group.items.some((item) => isActive(item.href))) {
            next[`${section.key}:${group.key}`] = true;
          }
        });
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
              {section.groups.map((group) => {
                const groupKey = `${section.key}:${group.key}`;
                const isExpanded = expandedGroups[groupKey] ?? true;
                return (
                  <div key={group.key} className="cogita-sidebar-subsection">
                    <button
                      type="button"
                      className="cogita-sidebar-subtitle"
                      data-expanded={isExpanded}
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [groupKey]: !isExpanded
                        }))
                      }
                    >
                      {group.title}
                    </button>
                    {isExpanded && (
                      <div className="cogita-sidebar-sublinks">
                        {group.items.map((item) =>
                          item.disabled ? (
                            <span key={`${group.key}-${item.label}`} className="cogita-sidebar-item is-disabled">
                              {item.label}
                              {item.badge ? <span className="cogita-sidebar-badge">{item.badge}</span> : null}
                            </span>
                          ) : (
                            <a key={item.href} href={item.href} data-active={isActive(item.href)}>
                              {item.label}
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
