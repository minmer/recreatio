import type { Node } from 'reactflow';
import type { RoleNodeData } from './roleGraphTypes';
import { ApiError } from '../../lib/api';

export const stripRoleId = (id: string) => (id.startsWith('role:') ? id.slice(5) : id);

export const formatApiError = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const text = error.message?.trim();
    if (!text) return fallback;
    if (text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        return text;
      }
    }
    return text;
  }
  return fallback;
};

export const createDraftId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `recovery-plan:draft-${crypto.randomUUID()}`;
  }
  return `recovery-plan:draft-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

export const isRecoveryNode = (node?: Node<RoleNodeData>) => Boolean(node?.data.nodeType?.startsWith('recovery'));
export const isExternalNode = (node?: Node<RoleNodeData>) => node?.data.nodeType === 'external';
