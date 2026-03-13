import { CogitaStoryboardEdit, type CogitaStoryboardEditProps, type StoryboardWorkspaceMode } from './CogitaStoryboardEdit';

export type { StoryboardWorkspaceMode };

export type CogitaStoryboardWorkspaceProps = Omit<CogitaStoryboardEditProps, 'knowledgeSearchLayout'> & {
  knowledgeSearchLayout?: 'basic' | 'workspace';
};

export function CogitaStoryboardWorkspace(props: CogitaStoryboardWorkspaceProps) {
  return <CogitaStoryboardEdit {...props} knowledgeSearchLayout={props.knowledgeSearchLayout ?? 'basic'} />;
}
