import { useNavigate } from 'react-router-dom';
import { CgHomePage } from './CgHomePage';
import { CgLibraryPage } from './CgLibraryPage';
import { CgTypeEditorPage } from './CgTypeEditorPage';
import { CgEntityListPage } from './CgEntityListPage';
import { CgEntityEditorPage } from './CgEntityEditorPage';

export function CgApp({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const segments = pathname.split('/').filter(Boolean);

  // /cg/libraries/:libId/types/:typeId/entities/:entityId/edit
  if (
    segments[0] === 'cg' &&
    segments[1] === 'libraries' && segments[2] &&
    segments[3] === 'types' && segments[4] &&
    segments[5] === 'entities' && segments[6] &&
    segments[7] === 'edit'
  ) {
    const libId = Number(segments[2]);
    const typeId = Number(segments[4]);
    const entityId = Number(segments[6]);
    if (!isNaN(libId) && !isNaN(typeId) && !isNaN(entityId)) {
      return (
        <CgEntityEditorPage
          libId={libId}
          typeId={typeId}
          entityId={entityId}
          onSaved={() => navigate(`/cg/libraries/${libId}/types/${typeId}/entities`)}
          onBack={() => navigate(`/cg/libraries/${libId}/types/${typeId}/entities`)}
        />
      );
    }
  }

  // /cg/libraries/:libId/types/:typeId/entities/new
  if (
    segments[0] === 'cg' &&
    segments[1] === 'libraries' && segments[2] &&
    segments[3] === 'types' && segments[4] &&
    segments[5] === 'entities' && segments[6] === 'new'
  ) {
    const libId = Number(segments[2]);
    const typeId = Number(segments[4]);
    if (!isNaN(libId) && !isNaN(typeId)) {
      return (
        <CgEntityEditorPage
          libId={libId}
          typeId={typeId}
          onSaved={entityId => navigate(`/cg/libraries/${libId}/types/${typeId}/entities/${entityId}/edit`)}
          onBack={() => navigate(`/cg/libraries/${libId}/types/${typeId}/entities`)}
        />
      );
    }
  }

  // /cg/libraries/:libId/types/:typeId/entities
  if (
    segments[0] === 'cg' &&
    segments[1] === 'libraries' && segments[2] &&
    segments[3] === 'types' && segments[4] &&
    segments[5] === 'entities'
  ) {
    const libId = Number(segments[2]);
    const typeId = Number(segments[4]);
    if (!isNaN(libId) && !isNaN(typeId)) {
      return (
        <CgEntityListPage
          libId={libId}
          typeId={typeId}
          typeName=""
          onNew={() => navigate(`/cg/libraries/${libId}/types/${typeId}/entities/new`)}
          onEdit={entityId => navigate(`/cg/libraries/${libId}/types/${typeId}/entities/${entityId}/edit`)}
          onBack={() => navigate(`/cg/libraries/${libId}`)}
        />
      );
    }
  }

  // /cg/libraries/:libId/types/:typeId
  if (segments[0] === 'cg' && segments[1] === 'libraries' && segments[2] && segments[3] === 'types' && segments[4]) {
    const libId = Number(segments[2]);
    const typeId = Number(segments[4]);
    if (!isNaN(libId) && !isNaN(typeId)) {
      return <CgTypeEditorPage libId={libId} typeId={typeId} />;
    }
  }

  // /cg/libraries/:libId
  if (segments[0] === 'cg' && segments[1] === 'libraries' && segments[2]) {
    const libId = Number(segments[2]);
    if (!isNaN(libId)) {
      return <CgLibraryPage libId={libId} />;
    }
  }

  // /cg
  return <CgHomePage />;
}
