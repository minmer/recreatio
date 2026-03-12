import { CogitaLibraryStoryboardsPage, type CogitaLibraryStoryboardsPageProps } from './CogitaLibraryStoryboardsPage';

export type CogitaStoryboardEditPageProps = Omit<CogitaLibraryStoryboardsPageProps, 'mode' | 'storyboardId'> & {
  storyboardId?: string;
};

export function CogitaStoryboardEditPage({ storyboardId, ...props }: CogitaStoryboardEditPageProps) {
  return <CogitaLibraryStoryboardsPage {...props} mode={storyboardId ? 'edit' : 'create'} storyboardId={storyboardId} />;
}

