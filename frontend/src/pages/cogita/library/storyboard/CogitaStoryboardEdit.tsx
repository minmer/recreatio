import { CogitaStoryboardWorkspace, type CogitaStoryboardWorkspaceProps } from './CogitaStoryboardWorkspace';

export type CogitaStoryboardEditProps = Omit<CogitaStoryboardWorkspaceProps, 'mode' | 'storyboardId'> & {
  storyboardId?: string;
};

export function CogitaStoryboardEdit({ storyboardId, ...props }: CogitaStoryboardEditProps) {
  return <CogitaStoryboardWorkspace {...props} mode={storyboardId ? 'edit' : 'create'} storyboardId={storyboardId} />;
}

