import { CogitaStoryboardEdit, type CogitaStoryboardEditProps } from './CogitaStoryboardEdit';

type CogitaStoryboardOverviewProps = Omit<CogitaStoryboardEditProps, 'mode'> & {
  storyboardId: string;
};

export function CogitaStoryboardOverview({ storyboardId, ...props }: CogitaStoryboardOverviewProps) {
  return <CogitaStoryboardEdit {...props} mode="overview" storyboardId={storyboardId} />;
}

