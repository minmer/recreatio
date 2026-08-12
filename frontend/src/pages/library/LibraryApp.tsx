import { useLocation, useNavigate } from 'react-router-dom';
import { getLibraryCopy } from './libraryCopy';
import { LibraryShell } from './LibraryShell';
import { LibraryDashboardPage } from './LibraryDashboardPage';
import { LibraryWorksPage } from './LibraryWorksPage';
import { LibraryWorkEditorPage } from './LibraryWorkEditorPage';
import { LibraryEditionEditorPage } from './LibraryEditionEditorPage';
import { LibraryShelfPage } from './LibraryShelfPage';
import { LibraryPeoplePage } from './LibraryPeoplePage';
import { LibraryPublishersPage, LibraryShelvesPage, LibraryTagsPage } from './LibraryRegistryPages';
import { LibraryLoansPage, LibraryReadingPage } from './LibraryActivityPages';
import { LibraryDataPage } from './LibraryDataPage';

function numericId(segment: string | undefined): number | null {
  if (!segment) return null;
  const parsed = Number(segment);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Path-based router for the module, matching how CgApp routes: the app uses one
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
    if (!section) return <LibraryDashboardPage t={t} />;

    if (section === 'works') {
      // /library/works/new
      if (segments[2] === 'new') return <LibraryWorkEditorPage t={t} workId={null} />;

      const workId = numericId(segments[2]);
      if (workId !== null) {
        // /library/works/:id/editions/new
        if (segments[3] === 'editions' && segments[4] === 'new') {
          return <LibraryEditionEditorPage t={t} editionId={null} newForWorkId={workId} />;
        }
        return <LibraryWorkEditorPage t={t} workId={workId} />;
      }

      return (
        <LibraryWorksPage
          t={t}
          initialPersonId={numericId(search.get('personId') ?? undefined)}
          initialTagId={numericId(search.get('tagId') ?? undefined)}
        />
      );
    }

    if (section === 'editions') {
      const editionId = numericId(segments[2]);
      if (editionId !== null) {
        return <LibraryEditionEditorPage t={t} editionId={editionId} newForWorkId={null} />;
      }
      navigate('/library/works', { replace: true });
      return null;
    }

    if (section === 'shelf') {
      return <LibraryShelfPage t={t} initialShelfId={numericId(search.get('shelfId') ?? undefined)} />;
    }

    if (section === 'people') return <LibraryPeoplePage t={t} />;
    if (section === 'publishers') return <LibraryPublishersPage t={t} />;
    if (section === 'shelves') return <LibraryShelvesPage t={t} />;
    if (section === 'tags') return <LibraryTagsPage t={t} />;
    if (section === 'loans') return <LibraryLoansPage t={t} />;
    if (section === 'reading') return <LibraryReadingPage t={t} />;
    if (section === 'data') return <LibraryDataPage t={t} />;

    return <LibraryDashboardPage t={t} />;
  };

  return (
    <LibraryShell t={t} language={language} onLanguageChange={onLanguageChange} onExit={onExit}>
      {render()}
    </LibraryShell>
  );
}
