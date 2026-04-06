import {
  CogitaStoryboardRuntime,
  type CogitaStoryboardRuntimeProps
} from './components/runtime/storyboard/CogitaStoryboardRuntime';

export type { CogitaStoryboardRuntimeProps };

export function CogitaStoryboardRuntimePage(props: CogitaStoryboardRuntimeProps) {
  return <CogitaStoryboardRuntime {...props} />;
}
