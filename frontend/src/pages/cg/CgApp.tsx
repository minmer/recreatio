import { CgHomePage } from './CgHomePage';
import { CgLibraryPage } from './CgLibraryPage';
import { CgTypeEditorPage } from './CgTypeEditorPage';

export function CgApp({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);

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
