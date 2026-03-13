import { CogitaDependencyEdit, type CogitaDependencyEditProps } from './CogitaDependencyEdit';

export type CogitaDependencySearchProps = Omit<CogitaDependencyEditProps, 'mode'>;

export function CogitaDependencySearch(props: CogitaDependencySearchProps) {
  return <CogitaDependencyEdit {...props} mode="search" />;
}
