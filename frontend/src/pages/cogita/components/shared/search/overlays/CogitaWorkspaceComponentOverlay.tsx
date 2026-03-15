import type { ReactNode } from 'react';
import { CogitaOverlay } from '../../../CogitaOverlay';

export function CogitaWorkspaceComponentOverlay({
  open,
  title,
  closeLabel,
  onClose,
  workspaceLinkTo,
  workspaceLinkLabel,
  children
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  workspaceLinkTo?: string;
  workspaceLinkLabel?: string;
  children: ReactNode;
}) {
  return (
    <CogitaOverlay
      open={open}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      size="wide"
      workspaceActionLabel={workspaceLinkLabel}
      workspaceActionTo={workspaceLinkTo}
    >
      {children}
    </CogitaOverlay>
  );
}
