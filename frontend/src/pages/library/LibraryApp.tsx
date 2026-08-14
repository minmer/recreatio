import { useLocation, useNavigate } from 'react-router-dom';
import { getLibraryCopy } from './libraryCopy';
import { LibraryShell } from './LibraryShell';
import { LibraryDashboardPage } from './LibraryDashboardPage';
import { LibraryQuotesPage } from './LibraryQuotesPage';
import { LibraryQuoteEditorPage } from './LibraryQuoteEditorPage';
import { LibraryWorksPage } from './LibraryWorksPage';
import { LibraryWorkEditorPage } from './LibraryWorkEditorPage';
import { LibraryExpressionEditorPage } from './LibraryExpressionEditorPage';
import { LibraryManifestationEditorPage } from './LibraryManifestationEditorPage';
import { LibraryShelfPage } from './LibraryShelfPage';
import { LibraryArrangementPage } from './LibraryArrangementPage';
import { LibraryPeoplePage } from './LibraryPeoplePage';
import { LibraryPublishersPage, LibraryShelvesPage, LibraryTagsPage } from './LibraryRegistryPages';
import { LibraryPlacementGroupsPage } from './LibraryPlacementGroupsPage';
import { LibraryLoansPage, LibraryReadingPage } from './LibraryActivityPages';
import { LibraryDataPage } from './LibraryDataPage';

function numericId(segment: string | undefined | null): number | null {
  if (!segment) return null;
  const parsed = Number(segment);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Path-based router for the module, matching how CgApp routes: the app runs one
 * HashRouter and dispatches whole sections rather than nesting <Route> trees.
 */
export function LibraryApp({
  language,
  onLanguageChange,
  onExit
}: {
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  onExit: () => void;
}) {
  const t = getLibraryCopy(language);
  const navigate = useNavigate();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const search = new URLSearchParams(location.search);

  // segments[0] is always 'library'; the section is segments[1].
  const section = segments[1];

  const render = () => {
    if (!section) return <LibraryDashboardPage t={t} language={language} />;

    if (section === 'quotes') {
      if (segments[2] === 'new') {
        return (
          <LibraryQuoteEditorPage
            t={t}
            language={language}
            quoteId={null}
            presetWorkId={numericId(search.get('workId'))}
          />
        );
      }
      const quoteId = numericId(segments[2]);
      if (quoteId !== null) {
        return <LibraryQuoteEditorPage t={t} language={language} quoteId={quoteId} presetWorkId={null} />;
      }
      return (
        <LibraryQuotesPage
          t={t}
          language={language}
          initialWorkId={numericId(search.get('workId'))}
          initialTagId={numericId(search.get('tagId'))}
        />
      );
    }

    if (section === 'works') {
      if (segments[2] === 'new') return <LibraryWorkEditorPage t={t} workId={null} />;

      const workId = numericId(segments[2]);
      if (workId !== null) {
        if (segments[3] === 'expressions' && segments[4] === 'new') {
          return <LibraryExpressionEditorPage t={t} expressionId={null} newForWorkId={workId} />;
        }
        if (segments[3] === 'manifestations' && segments[4] === 'new') {
          return (
            <LibraryManifestationEditorPage
              t={t}
              manifestationId={null}
              newForWorkId={workId}
              presetExpressionId={numericId(search.get('expressionId'))}
            />
          );
        }
        return <LibraryWorkEditorPage t={t} workId={workId} />;
      }

      return (
        <LibraryWorksPage
          t={t}
          initialPersonId={numericId(search.get('personId'))}
          initialTagId={numericId(search.get('tagId'))}
        />
      );
    }

    if (section === 'expressions') {
      const expressionId = numericId(segments[2]);
      if (expressionId !== null) {
        return <LibraryExpressionEditorPage t={t} expressionId={expressionId} newForWorkId={null} />;
      }
      navigate('/library/works', { replace: true });
      return null;
    }

    if (section === 'manifestations') {
      const manifestationId = numericId(segments[2]);
      if (manifestationId !== null) {
        return (
          <LibraryManifestationEditorPage
            t={t}
            manifestationId={manifestationId}
            newForWorkId={null}
            presetExpressionId={null}
          />
        );
      }
      navigate('/library/works', { replace: true });
      return null;
    }

    if (section === 'shelf') {
      return <LibraryShelfPage t={t} initialShelfId={numericId(search.get('shelfId'))} />;
    }

    if (section === 'arrangement') return <LibraryArrangementPage t={t} />;
    if (section === 'people') return <LibraryPeoplePage t={t} />;
    if (section === 'publishers') return <LibraryPublishersPage t={t} />;
    if (section === 'shelves') return <LibraryShelvesPage t={t} />;
    if (section === 'groups') return <LibraryPlacementGroupsPage t={t} />;
    if (section === 'tags') return <LibraryTagsPage t={t} />;
    if (section === 'loans') return <LibraryLoansPage t={t} />;
    if (section === 'reading') return <LibraryReadingPage t={t} />;
    if (section === 'data') return <LibraryDataPage t={t} language={language} />;

    return <LibraryDashboardPage t={t} language={language} />;
  };

  return (
    <LibraryShell t={t} language={language} onLanguageChange={onLanguageChange} onExit={onExit}>
      {render()}
    </LibraryShell>
  );
}
