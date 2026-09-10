import { CogitaStoryboardEdit, type CogitaStoryboardEditProps } from './CogitaStoryboardEdit';

type CogitaStoryboardSearchProps = Omit<CogitaStoryboardEditProps, 'mode' | 'storyboardId'>;

export function CogitaStoryboardSearch(props: CogitaStoryboardSearchProps) {
  return <CogitaStoryboardEdit {...props} mode="search" />;
}

