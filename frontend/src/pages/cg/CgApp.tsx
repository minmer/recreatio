import { useNavigate, useLocation } from 'react-router-dom';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import '../../styles/cg.css';
import { CgGraphPage } from './CgGraphPage';
import { CgHomePage } from './CgHomePage';
import { CgLibraryPage } from './CgLibraryPage';
import { CgNodeEditorPage } from './CgNodeEditorPage';
import { CgStudioPage } from './CgStudioPage';

// Route structure:
//   /cg                          → home (library list)
//   /cg/library/:libId           → library overview
//   /cg/library/:libId/studio    → schema editor
//   /cg/library/:libId/nodes     → node list
//   /cg/library/:libId/nodes/:nodeId → node editor

function parseRoute(pathname: string) {
  const segs = pathname.split('/').filter(Boolean);
  // segs[0] === 'cg'
  if (segs.length <= 1) return { view: 'home' as const };
  if (segs[1] === 'library' && segs[2]) {
    const libId = segs[2];
    if (!segs[3]) return { view: 'library' as const, libId };
    if (segs[3] === 'studio') return { view: 'studio' as const, libId };
    if (segs[3] === 'nodes' && segs[4]) return { view: 'node' as const, libId, nodeId: segs[4] };
    if (segs[3] === 'nodes') return { view: 'nodes' as const, libId };
    return { view: 'library' as const, libId };
  }
  return { view: 'home' as const };
}

interface Props {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  secureMode: boolean;
  onLogout: () => void;
}

export function CgApp({ copy, onNavigate, secureMode: _secureMode, onLogout }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const route = parseRoute(location.pathname);

  const goHome = () => navigate('/cg');
  const goLibrary = (libId: string) => navigate(`/cg/library/${libId}`);
  const goStudio = (libId: string) => navigate(`/cg/library/${libId}/studio`);
  const goNodes = (libId: string) => navigate(`/cg/library/${libId}/nodes`);
  const goNode = (libId: string, nodeId: string) => navigate(`/cg/library/${libId}/nodes/${nodeId}`);

  function handleLibraryNav(sub: string) {
    if (route.view === 'home') return;
    const libId = (route as { libId: string }).libId;
    if (sub === 'home') goHome();
    else if (sub === 'studio') goStudio(libId);
    else if (sub === 'nodes') goNodes(libId);
    else goLibrary(libId);
  }

  const currentLibId = route.view !== 'home' ? (route as { libId: string }).libId : undefined;

  const cg = copy.cg;

  // Sidebar nav items when inside a library
  const libraryNav = currentLibId
    ? [
        { key: 'library', label: cg.nav.overview,      icon: '◎' },
        { key: 'studio',  label: cg.nav.schemaEditor,  icon: '✎' },
        { key: 'nodes',   label: cg.nav.nodes,         icon: '⊞' },
      ]
    : [];

  const activeView = route.view === 'node' ? 'nodes' : route.view;

  return (
    <div className="cg-root">
      {/* Header */}
      <header className="cg-header">
        <button className="cg-header-logo" type="button" onClick={goHome}>
          CG
        </button>
        {currentLibId && (
          <>
            <span className="cg-header-sep">/</span>
            <span className="cg-header-crumb">
              {route.view === 'studio' ? cg.nav.schemaEditor
               : route.view === 'nodes' ? cg.nav.nodes
               : route.view === 'node' ? cg.studio.title
               : cg.nav.overview}
            </span>
          </>
        )}
        <div className="cg-header-actions">
          <button
            className="cg-btn cg-btn-ghost cg-btn-sm"
            type="button"
            onClick={() => onNavigate('cogita')}
            title={cg.nav.switchToCogita}
          >
            {cg.nav.switchToCogita}
          </button>
          <button
            className="cg-btn cg-btn-ghost cg-btn-sm"
            type="button"
            onClick={onLogout}
          >
            {cg.nav.signOut}
          </button>
        </div>
      </header>

      <div className="cg-body">
        {/* Sidebar — only when inside a library */}
        {currentLibId && (
          <nav className="cg-sidebar">
            <div className="cg-sidebar-section">
              <button
                className="cg-nav-item"
                type="button"
                onClick={goHome}
              >
                <span className="cg-nav-item-icon">☰</span>
                {cg.nav.allLibraries}
              </button>
            </div>
            <div className="cg-sidebar-section">
              <p className="cg-sidebar-label">{cg.title}</p>
              {libraryNav.map((item) => (
                <button
                  key={item.key}
                  className={`cg-nav-item${activeView === item.key ? ' active' : ''}`}
                  type="button"
                  onClick={() => {
                    if (item.key === 'library') goLibrary(currentLibId);
                    else if (item.key === 'studio') goStudio(currentLibId);
                    else if (item.key === 'nodes') goNodes(currentLibId);
                  }}
                >
                  <span className="cg-nav-item-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Main content */}
        <main className="cg-main">
          {route.view === 'home' && (
            <CgHomePage
              copy={copy}
              onOpenLibrary={goLibrary}
              onNavigateToCogita={() => onNavigate('cogita')}
            />
          )}
          {route.view === 'library' && currentLibId && (
            <CgLibraryPage
              copy={copy}
              libId={currentLibId}
              onNavigate={handleLibraryNav}
            />
          )}
          {route.view === 'studio' && currentLibId && (
            <CgStudioPage copy={copy} libId={currentLibId} />
          )}
          {route.view === 'nodes' && currentLibId && (
            <CgGraphPage
              copy={copy}
              libId={currentLibId}
              onOpenNode={(nodeId) => goNode(currentLibId, nodeId)}
            />
          )}
          {route.view === 'node' && currentLibId && (route as { nodeId: string }).nodeId && (
            <CgNodeEditorPage
              copy={copy}
              libId={currentLibId}
              nodeId={(route as { nodeId: string }).nodeId}
              onBack={() => goNodes(currentLibId)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
