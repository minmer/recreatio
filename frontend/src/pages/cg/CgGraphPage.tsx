import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import { type CgFieldDef, type CgNodeKind, getLibrary } from './api/cgApi';
import { CgEntityPanel } from './CgEntityPanel';

interface Props {
  copy: Copy;
  libId: string;
  onOpenNode: (nodeId: string) => void;
}

export function CgGraphPage({ copy, libId, onOpenNode }: Props) {
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLibrary(libId)
      .then((d) => {
        setKinds(d.nodeKinds);
        setFieldDefs(d.fieldDefs);
      })
      .catch(() => setError(copy.cg.graph.loadFailed));
  }, [libId]);

  return (
    <div>
      <h1 className="cg-page-title">{copy.cg.graph.title}</h1>
      {error && <p className="cg-error">{error}</p>}
      {kinds.length > 0 && (
        <CgEntityPanel
          copy={copy}
          libId={libId}
          kinds={kinds}
          fieldDefs={fieldDefs}
          allowSearch
          allowCreate
          allowEdit
          allowDelete
          onOpenNode={onOpenNode}
        />
      )}
    </div>
  );
}
