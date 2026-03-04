export type WorkspaceTransfer =
  | {
      kind: 'dependency_create_prefill';
      libraryId: string;
      infos: Array<{
        infoId: string;
        label?: string | null;
        infoType?: string | null;
      }>;
      createdAt: string;
    }
  | {
      kind: 'dependency_node_pick';
      libraryId: string;
      returnPath: string;
      targetNodeId: string;
      targetNodeType: 'info' | 'collection';
      selectedGraphId?: string | null;
      draft: {
        nodes: Array<{
          id: string;
          type: string;
          position: { x: number; y: number };
          data: {
            label: string;
            nodeType: string;
            itemType: string;
            itemId?: string | null;
            infoType?: string | null;
          };
        }>;
        edges: Array<{ id: string; source: string; target: string }>;
      };
      resolvedSelection?: {
        infoId: string;
        label: string;
        infoType?: string | null;
      };
      createdAt: string;
    };

const STORAGE_PREFIX = 'cogita.workspace.transfer:';

function storageKey(token: string) {
  return `${STORAGE_PREFIX}${token}`;
}

function createToken() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createWorkspaceTransfer(payload: Omit<WorkspaceTransfer, 'createdAt'>) {
  if (typeof window === 'undefined') return null;
  const token = createToken();
  const transfer: WorkspaceTransfer = {
    ...payload,
    createdAt: new Date().toISOString()
  } as WorkspaceTransfer;
  window.sessionStorage.setItem(storageKey(token), JSON.stringify(transfer));
  return token;
}

export function loadWorkspaceTransfer(token: string) {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(storageKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkspaceTransfer;
  } catch {
    return null;
  }
}

export function updateWorkspaceTransfer(token: string, update: (current: WorkspaceTransfer) => WorkspaceTransfer | null) {
  if (typeof window === 'undefined') return null;
  const current = loadWorkspaceTransfer(token);
  if (!current) return null;
  const next = update(current);
  if (!next) {
    window.sessionStorage.removeItem(storageKey(token));
    return null;
  }
  window.sessionStorage.setItem(storageKey(token), JSON.stringify(next));
  return next;
}

export function removeWorkspaceTransfer(token: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(storageKey(token));
}
