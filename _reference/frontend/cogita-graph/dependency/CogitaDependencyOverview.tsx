import { CogitaDependencyEdit, type CogitaDependencyEditProps } from './CogitaDependencyEdit';

export type CogitaDependencyOverviewProps = Omit<CogitaDependencyEditProps, 'mode'>;

export function CogitaDependencyOverview(props: CogitaDependencyOverviewProps) {
  return <CogitaDependencyEdit {...props} mode="overview" />;
}
